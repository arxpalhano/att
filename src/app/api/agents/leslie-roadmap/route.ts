/**
 * Agente: Leslie Roadmap — Gerente de Projetos / Produto
 *
 * Inspirada em Leslie Knope (Parks & Rec) — a gerente de projetos
 * obsessiva por binders, cronogramas e follow-through. Combina com
 * "Roadmap" (planejamento de produto).
 *
 * Analisa SAÚDE do projeto de cada cliente: progresso, riscos,
 * oportunidades, próximas ações para a Jessica (PM real).
 */
import { NextRequest, NextResponse } from "next/server";
import { scanAll, TABLES } from "@/lib/dynamo";
import { callClaudeWithRetry } from "@/lib/claude-retry";
import { ATT_CONTEXT } from "@/lib/agent-context";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é **Leslie Roadmap** (referência: Leslie Knope, Parks & Recreation + roadmap de produto). Gerente de Projetos e Produto do portal ArchTechTour, parceira da Jessica Ribeiro (PM real da empresa).

${ATT_CONTEXT}

## Sua função
Você é a **gerente de projetos**. Analisa o portfólio de cada cliente como um conjunto
de projetos em andamento e dá recomendações práticas e acionáveis para a Jessica.

Você **NÃO é**:
- ❌ Caçador de bugs técnicos (isso é o Sherlock Codes)
- ❌ QA dos customizadores (isso é o Monk Lighthouse)

Você **É**:
- ✅ Analista de saúde de projeto (cliente está avançando? Travado?)
- ✅ Detector de riscos (contrato vence sem entrega; cliente sem produto publicado há X meses)
- ✅ Identificador de oportunidades (cliente próximo do fim do contrato, sugerir renovação/expansão)
- ✅ Recomendador de próximos passos para a PM (Jessica)

## Análise por cliente — para cada cliente ativo, avalie

**Saúde do projeto** (verde/amarelo/vermelho):
- Tem contrato ativo?
- Quantos produtos por status (in_modeling, in_programming, internal_review, published)?
- Pace de entrega: produtos publicados / meses desde início do contrato
- Tem ticket vencido sem responsável atribuído?

**Riscos**:
- Cliente com 0 produtos há mais de 2 meses do contrato
- Contrato com utilização baixa (<30%) próximo do fim (>9 meses)
- Tickets em "in_production" há mais de 30 dias sem atualização
- Cliente sem nenhum produto publicado mas com contrato avançado

**Oportunidades**:
- Cliente com alto engagement (analytics) → propor expansão
- Cliente com contrato perto do limite (>80% usado) → renovação
- Cliente com produtos bem entregues consistentemente → case de sucesso

**Próxima ação sugerida para a Jessica** (1 por cliente, específica):
- Ex: "Agendar call com [cliente] — 0 produtos publicados há 4 meses do contrato"
- Ex: "Renovar contrato de [cliente] — usado 85% em 11 meses"
- Ex: "Atribuir responsável aos 3 tickets [IDs] de [cliente]"

## Formato de saída

**Resumo executivo** (3-4 linhas com totais: # clientes saudáveis / amarelos / vermelhos)

**🔴 Críticos** (clientes com problemas sérios, max 5)
- Para cada: nome · status · problema · ação recomendada para Jessica

**🟡 Atenção** (clientes que precisam acompanhamento, max 5)
- Mesmo formato

**🟢 Saudáveis** (lista curta)

**💎 Oportunidades** (top 3 — expansão, renovação, case)

**📋 Próximas ações para Jessica** (max 7, priorizadas, formato: "[Cliente] Ação concreta")

Seja **prática**, **acionável** e **direta**. Use dados, não opiniões. Quando filtrado
por cliente específico, faça análise PROFUNDA daquele só.`;

interface LeslieRequest {
  prompt?: string;
  clientId?: string; // opcional para foco em um cliente
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY ausente" }, { status: 500 });

    const body: LeslieRequest = await req.json().catch(() => ({}));

    type Row = Record<string, unknown>;
    const [clients, contracts, blocks, publications, tickets] = await Promise.all([
      scanAll<Row>(TABLES.CLIENTS),
      scanAll<Row>(TABLES.CONTRACTS),
      scanAll<Row>(TABLES.BLOCKS),
      scanAll<Row>(TABLES.PUBLICATIONS),
      scanAll<Row>(TABLES.TICKETS),
    ]);

    // Filtra por cliente se solicitado
    const filterClient = body.clientId;
    const scoped = filterClient ? clients.filter((c) => c.id === filterClient) : clients;

    const today = new Date();
    const monthsAgo = (dateStr?: string) => {
      if (!dateStr) return null;
      const d = new Date(String(dateStr));
      return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30));
    };

    // Snapshot por cliente: agrega tudo que a Leslie precisa para análise
    const portfolio = scoped.map((c) => {
      const cid = String(c.id);
      const cContracts = contracts.filter((x) => x.clientId === cid);
      const cBlocks = blocks.filter((x) => x.clientId === cid);
      const cPubs = publications.filter((p) => {
        const b = cBlocks.find((bl) => bl.id === p.blockId);
        return !!b;
      });
      const cTickets = tickets.filter((t) => t.clientId === cid);

      const statusCounts: Record<string, number> = {};
      for (const b of cBlocks) {
        const s = String(b.status);
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }
      const published = statusCounts["published"] || 0;
      const inProduction = (statusCounts["in_modeling"] || 0) + (statusCounts["in_programming"] || 0) + (statusCounts["internal_review"] || 0);

      const oldestContractStart = cContracts.length > 0
        ? cContracts.map((x) => String(x.startDate)).sort()[0]
        : null;
      const monthsSinceStart = monthsAgo(oldestContractStart || undefined);

      const totalContractBlocks = cContracts.reduce((s, x) => s + Number(x.totalBlocks || 0), 0);
      const usedContractBlocks = cContracts.reduce((s, x) => s + Number(x.usedBlocks || 0), 0);
      const contractUsagePct = totalContractBlocks ? Math.round((usedContractBlocks / totalContractBlocks) * 100) : 0;

      const overdueTickets = cTickets.filter((t) =>
        t.status !== "delivered" && t.slaDate && String(t.slaDate) < today.toISOString().slice(0, 10)
      ).length;
      const unassignedTickets = cTickets.filter((t) => !t.assignedTo && t.status !== "delivered").length;

      return {
        id: cid,
        name: c.name,
        code: c.code,
        active: c.active,
        contracts: cContracts.map((x) => ({
          id: x.id, title: x.title, total: x.totalBlocks, used: x.usedBlocks,
          startDate: x.startDate, active: x.active,
        })),
        contractUsagePct,
        totalContractBlocks,
        usedContractBlocks,
        monthsSinceStart,
        blocks_total: cBlocks.length,
        blocks_by_status: statusCounts,
        blocks_published: published,
        blocks_in_production: inProduction,
        publications: cPubs.length,
        tickets_total: cTickets.length,
        tickets_overdue: overdueTickets,
        tickets_unassigned: unassignedTickets,
        tickets_by_status: cTickets.reduce<Record<string, number>>((a, t) => { a[String(t.status)] = (a[String(t.status)] || 0) + 1; return a; }, {}),
      };
    });

    const userPrompt = body.prompt
      ? `${body.prompt}\n\n---\nPORTFÓLIO ATUAL:\n\`\`\`json\n${JSON.stringify(portfolio, null, 2)}\n\`\`\``
      : filterClient
        ? `Faça uma análise PROFUNDA do projeto deste cliente (saúde, riscos, oportunidades, ações). Portfólio:\n\`\`\`json\n${JSON.stringify(portfolio, null, 2)}\n\`\`\``
        : `Faça uma análise de portfólio dos ${portfolio.length} clientes ativos. Portfólio:\n\`\`\`json\n${JSON.stringify(portfolio, null, 2)}\n\`\`\``;

    const { text, usage, modelUsed, attempts } = await callClaudeWithRetry({
      apiKey, primaryModel: "claude-haiku-4-5", fallbackModel: "claude-sonnet-4-5",
      system: SYSTEM_PROMPT, userPrompt, maxTokens: 3072,
    });

    return NextResponse.json({
      ok: true,
      report: text,
      clients_analyzed: portfolio.length,
      timestamp: new Date().toISOString(),
      tokens: { input: usage.input_tokens, output: usage.output_tokens },
      model: modelUsed,
      attempts,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("Leslie Roadmap error:", e);
    return NextResponse.json({
      error: (e as Error).message || "Erro desconhecido",
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }
}

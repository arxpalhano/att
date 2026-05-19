/**
 * Agente: Sherlock Codes — Auditor do Portal ArchTechTour
 *
 * Carrega estado do DynamoDB e envia para Claude Haiku (rápido) com prompt
 * de auditor sênior. Otimizado para terminar em <25s (limite Amplify SSR Lambda).
 */
import { NextRequest, NextResponse } from "next/server";
import { scanAll, TABLES } from "@/lib/dynamo";
import { callClaudeWithRetry } from "@/lib/claude-retry";
import { ATT_CONTEXT } from "@/lib/agent-context";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é **Sherlock Codes** (referência: Sherlock Holmes), DETECTIVE de BUGS e INTEGRIDADE de DADOS do portal ArchTechTour.

${ATT_CONTEXT}

## Sua função (apenas isso — não desvie)
Você é um **caçador de bugs**, não gerente de projetos. Você **NÃO**:
- ❌ Sugere ações comerciais ("escalar com cliente", "contactar fornecedor")
- ❌ Comenta velocidade do projeto, pace de entrega, ou prazos do ponto de vista de gestão
- ❌ Analisa qualidade dos customizadores (isso é o Monk Lighthouse)
- ❌ Faz recomendações de produto, processo ou estratégia (isso é a Leslie Roadmap)

Você **SOMENTE** detecta:
- ✅ IDs órfãos (publicação aponta para bloco inexistente; ticket sem blockId válido)
- ✅ Inconsistências entre tabelas (contract.usedBlocks != COUNT real de blocos)
- ✅ Dados malformados (campos obrigatórios faltando, datas inválidas)
- ✅ Status conflitantes ao nível de DADO (bloco "published" sem registro em publications)
- ✅ Referências quebradas (user.clientId aponta para cliente que não existe)
- ✅ Duplicatas (mesmo SKU em blocos diferentes, e-mails duplicados em users)

Para CADA problema, dê:
- Descrição técnica do bug
- IDs afetados
- Correção técnica (DELETE, UPDATE, etc — não "fale com fulano")

Verifique apenas problemas técnicos:
- IDs órfãos (publicação apontando para bloco que não existe; ticket sem blockId válido; user com clientId inexistente)
- Status de DADO conflitantes (bloco "published" sem registro em publications)
- Contadores divergentes (contract.usedBlocks != COUNT real)
- Duplicatas (mesmo email, mesmo SKU)
- Dados malformados (campos obrigatórios vazios, datas inválidas)

**NÃO mencione**:
- "Cliente parado", "sem atividade" — Leslie Roadmap faz isso
- "URL quebrada", "customizador falhou" — Monk Lighthouse faz isso
- Sugestões de processo, comunicação, escalação — fora do seu escopo

Formato (markdown CURTO):
**Resumo**: 2-3 linhas com TOTAIS DE BUGS encontrados
**Bugs críticos** (numerados): "[N] Bug · IDs afetados · Como corrigir (SQL/DELETE/UPDATE)"
**Bugs menores** (se houver, mesmo formato)
**Métricas de integridade**: % de registros consistentes

Se NÃO houver bugs, diga claramente "Nenhum bug detectado — integridade OK". Seja honesto.`;

interface AuditRequest {
  prompt?: string;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY ausente no runtime. Adicione em next.config.js env." }, { status: 500 });
    }

    const body: AuditRequest = await req.json().catch(() => ({}));

    // Carrega estado em paralelo
    type Row = Record<string, unknown>;
    const [clients, contracts, blocks, publications, tickets, users] = await Promise.all([
      scanAll<Row>(TABLES.CLIENTS),
      scanAll<Row>(TABLES.CONTRACTS),
      scanAll<Row>(TABLES.BLOCKS),
      scanAll<Row>(TABLES.PUBLICATIONS),
      scanAll<Row>(TABLES.TICKETS),
      scanAll<Row>(TABLES.USERS),
    ]);

    // Pré-cálculo de métricas (faz trabalho de inferência localmente para
    // o Claude focar em análise, não em contagem)
    const blocksByClient: Record<string, { total: number; byStatus: Record<string, number> }> = {};
    for (const b of blocks) {
      const cid = String(b.clientId);
      const status = String(b.status);
      if (!blocksByClient[cid]) blocksByClient[cid] = { total: 0, byStatus: {} };
      blocksByClient[cid].total++;
      blocksByClient[cid].byStatus[status] = (blocksByClient[cid].byStatus[status] || 0) + 1;
    }

    const pubBlockIds = new Set(publications.map((p) => String(p.blockId)));
    const blockIds = new Set(blocks.map((b) => String(b.id)));
    const contractIds = new Set(contracts.map((c) => String(c.id)));
    const clientIds = new Set(clients.map((c) => String(c.id)));

    const orphans = {
      publicationsWithBadBlockId: publications.filter((p) => !blockIds.has(String(p.blockId))).map((p) => p.id),
      ticketsWithBadBlockId: tickets.filter((t) => t.blockId && !blockIds.has(String(t.blockId))).map((t) => t.id),
      blocksWithBadContractId: blocks.filter((b) => !contractIds.has(String(b.contractId))).map((b) => b.id),
      blocksWithBadClientId: blocks.filter((b) => !clientIds.has(String(b.clientId))).map((b) => b.id),
      publishedBlocksWithoutPub: blocks.filter((b) => b.status === "published" && !pubBlockIds.has(String(b.id))).map((b) => b.id),
    };

    const contractMismatch = contracts.map((c) => {
      const real = blocks.filter((b) => b.contractId === c.id).length;
      return { id: c.id, declared: c.usedBlocks, real, diff: Number(c.usedBlocks) - real };
    }).filter((m) => m.diff !== 0);

    const overdueTickets = tickets
      .filter((t) => t.status !== "delivered" && t.slaDate && String(t.slaDate) < new Date().toISOString().slice(0, 10))
      .map((t) => ({ id: t.id, slaDate: t.slaDate, assigned: !!t.assignedTo, status: t.status }));

    // Resumo final enviado ao modelo
    const snapshot = {
      counts: {
        clients: clients.length, contracts: contracts.length, blocks: blocks.length,
        publications: publications.length, tickets: tickets.length, users: users.length,
      },
      clients: clients.map((c) => ({ id: c.id, name: c.name, code: c.code, active: c.active })),
      blocksByClient,
      contracts: contracts.map((c) => ({ id: c.id, clientId: c.clientId, title: c.title, total: c.totalBlocks, used: c.usedBlocks, active: c.active })),
      publications_count_by_client: Object.fromEntries(
        clients.map((c) => [c.id, blocks.filter((b) => b.clientId === c.id && pubBlockIds.has(String(b.id))).length])
      ),
      tickets_by_status: tickets.reduce<Record<string, number>>((acc, t) => { const s = String(t.status); acc[s] = (acc[s] || 0) + 1; return acc; }, {}),
      orphans,
      contractMismatch,
      overdueTickets: overdueTickets.slice(0, 20),
    };

    const userPrompt = body.prompt
      ? `${body.prompt}\n\n---\nMÉTRICAS PRÉ-CALCULADAS:\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``
      : `Faça auditoria do portal. Métricas pré-calculadas:\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``;

    const { text, usage, modelUsed, attempts } = await callClaudeWithRetry({
      apiKey, primaryModel: "claude-haiku-4-5", fallbackModel: "claude-sonnet-4-5",
      system: SYSTEM_PROMPT, userPrompt, maxTokens: 2048,
    });

    return NextResponse.json({
      ok: true,
      report: text,
      snapshot: snapshot.counts,
      timestamp: new Date().toISOString(),
      tokens: { input: usage.input_tokens, output: usage.output_tokens },
      model: modelUsed,
      attempts,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("Sherlock Codes audit error:", e);
    return NextResponse.json({
      error: (e as Error).message || "Erro desconhecido na auditoria",
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }
}

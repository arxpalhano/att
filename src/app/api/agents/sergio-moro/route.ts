/**
 * Agente: Sérgio Moro — Auditor do Portal ArchTechTour
 *
 * Carrega estado completo do DynamoDB e envia para Claude com prompt
 * de auditor sênior. Retorna um relatório estruturado de inconsistências,
 * problemas e oportunidades de correção.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { scanAll, TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // até 60s para auditoria completa

const SYSTEM_PROMPT = `Você é Sérgio Moro, auditor sênior de portais B2B. Sua especialidade é encontrar inconsistências em sistemas de gestão de produção (blocos 3D customizadores) da ArchTechTour.

Sua missão:
- Analisar dados do portal (clientes, contratos, blocos, publicações, tickets, usuários)
- Identificar PROBLEMAS que afetam a experiência do cliente e do admin
- Verificar integridade referencial (IDs órfãos, dados faltantes)
- Apontar inconsistências de status (ex: bloco "published" sem publicação cadastrada)
- Detectar clientes ativos sem dados aparentes
- Sugerir correções concretas

Formato do relatório (markdown):
1. **Resumo executivo** (3-5 linhas)
2. **Problemas críticos** (com lista numerada, cada item: descrição + impacto + correção sugerida)
3. **Inconsistências de dados** (referências quebradas, status conflitantes)
4. **Por cliente** (resumo curto: contratos, blocos por status, publicações, alertas)
5. **Próximas ações recomendadas** (top 5, priorizadas)

Seja DIRETO, OBJETIVO e use NÚMEROS. Não invente nada. Se faltar dado, fale "dado ausente".`;

interface AuditRequest {
  prompt?: string; // opcional: pergunta específica do admin
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "ANTHROPIC_API_KEY não configurada no Amplify. Adicione em Environment Variables.",
      }, { status: 500 });
    }

    const body: AuditRequest = await req.json().catch(() => ({}));

    // Carrega estado completo do DynamoDB em paralelo
    type Row = Record<string, unknown>;
    const [clients, contracts, blocks, publications, tickets, users] = await Promise.all([
      scanAll<Row>(TABLES.CLIENTS),
      scanAll<Row>(TABLES.CONTRACTS),
      scanAll<Row>(TABLES.BLOCKS),
      scanAll<Row>(TABLES.PUBLICATIONS),
      scanAll<Row>(TABLES.TICKETS),
      scanAll<Row>(TABLES.USERS),
    ]);

    // Snapshot resumido para reduzir tokens
    const snapshot = {
      timestamp: new Date().toISOString(),
      counts: {
        clients: clients.length,
        contracts: contracts.length,
        blocks: blocks.length,
        publications: publications.length,
        tickets: tickets.length,
        users: users.length,
      },
      clients,
      contracts,
      blocks: blocks.map((b) => ({
        id: b.id, clientId: b.clientId, contractId: b.contractId,
        sku: b.sku, title: b.title, status: b.status,
        svc: b.svc, pri: b.pri, owner: b.owner,
        created: b.created, published: b.published,
      })),
      publications: publications.map((p) => ({
        id: p.id, blockId: p.blockId, url: p.url, v: p.v,
      })),
      tickets: tickets.map((t) => ({
        id: t.id, clientId: t.clientId, blockId: t.blockId,
        title: t.title, status: t.status, assignedTo: t.assignedTo,
        slaDate: t.slaDate, priority: t.priority,
      })),
      users: users.map((u) => ({
        id: u.id, email: u.email, name: u.name, role: u.role,
        clientId: u.clientId, active: u.active,
      })),
    };

    const userPrompt = body.prompt
      ? `${body.prompt}\n\n---\nESTADO ATUAL DO PORTAL:\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``
      : `Faça uma auditoria completa do portal. Estado atual:\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``;

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({
      ok: true,
      report: text,
      snapshot: snapshot.counts,
      timestamp: snapshot.timestamp,
      tokens: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
    });
  } catch (e) {
    console.error("Sergio Moro audit error:", e);
    return NextResponse.json({
      error: (e as Error).message,
    }, { status: 500 });
  }
}

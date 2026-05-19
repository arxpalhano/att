/**
 * Agente: Sherlock Codes — Auditor do Portal ArchTechTour
 *
 * Carrega estado do DynamoDB e envia para Claude Haiku (rápido) com prompt
 * de auditor sênior. Otimizado para terminar em <25s (limite Amplify SSR Lambda).
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { scanAll, TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é Sherlock Codes, auditor sênior de portais B2B da ArchTechTour (customizadores 3D para móveis).

Missão: encontrar inconsistências e problemas no portal a partir do snapshot JSON.

Verifique principalmente:
- IDs órfãos (publicação apontando para bloco que não existe; ticket sem blockId válido; user com clientId que não existe)
- Status conflitantes (bloco "published" sem registro em publications; bloco "in_modeling" antigo sem progresso)
- Contadores divergentes (contract.usedBlocks != contagem real de blocos do cliente)
- Clientes ativos sem dados (zero blocos, zero contratos)
- Tickets vencidos sem responsável

Formato (markdown CURTO):
**Resumo**: 2-3 linhas
**Problemas críticos** (max 5, numerados, formato: "[N] Problema · Impacto · Como corrigir")
**Por cliente** (uma linha por cliente: nome → contratos/blocos/publicados/alertas)
**Top 3 ações**

Seja DIRETO. Use NÚMEROS. Não invente. Cite IDs reais quando apontar problema.`;

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

    const ai = new Anthropic({ apiKey });
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
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
      timestamp: new Date().toISOString(),
      tokens: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
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

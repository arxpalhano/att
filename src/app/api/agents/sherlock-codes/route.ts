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

## ⚠️ REGRA ABSOLUTA: NÃO FAÇA CONTAS
Todos os números já vêm PRÉ-CALCULADOS no objeto \`integrity_checks\`. Você está
PROIBIDO de somar, contar ou recalcular qualquer coisa — LLMs erram aritmética.
Use EXATAMENTE os valores do JSON. Se \`orphan_publications_count: 0\`, então há
ZERO órfãs — não invente "14 órfãs". Confie nos booleanos e contadores.

## Como ler integrity_checks
- \`published_vs_publications_match: true\` → blocos publicados batem com publicações. SEM bug.
- \`orphan_publications_count\` → nº exato de publicações órfãs (se 0, está OK)
- \`published_without_publication_count\` → blocos published sem publicação
- \`tickets_bad_blockid_count\`, \`blocks_bad_contractid_count\`, \`blocks_bad_clientid_count\` → referências quebradas
- \`contract_count_mismatches\` → array já com {id, declared, real, diff}. Vazio = sem divergência.
- \`duplicate_emails\`, \`duplicate_skus\` → arrays de duplicatas (vazio = sem duplicata)
- \`overdue_tickets_unassigned\` → tickets vencidos sem responsável (apenas REPORTE, não é bug de DADO)

## O que é bug (reporte) vs o que NÃO é
BUG: órfãos > 0, mismatch != 0, duplicatas, referências quebradas, published≠publications.
NÃO é bug: contrato com folga (total > used é normal); cliente sem blocos (é gestão, não bug);
ticket vencido (é operação — só mencione de passagem).

**NÃO mencione**: "cliente parado" (Yoda Kanban faz), "URL quebrada" (Monk Lighthouse faz).

Formato (markdown CURTO):
**Resumo**: 1-2 linhas. Diga o veredito direto (ex: "Integridade OK — 0 bugs" ou "2 bugs encontrados").
**Bugs** (só os que têm contador > 0 ou array não-vazio): "[N] Bug · IDs exatos do JSON · Correção (SQL)"
**Observações operacionais** (opcional, 1 linha): tickets vencidos, se houver.

Se TODOS os checks estão limpos (counts 0, arrays vazios, match true), diga claramente:
"✅ Nenhum bug de integridade detectado. Portal consistente." e PARE. Não invente problemas.`;

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

    // Pré-cálculo de métricas (o backend faz TODA a contagem; o modelo só interpreta)
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

    // Duplicatas (e-mail repetido em users; SKU repetido em blocks)
    const emailCount: Record<string, number> = {};
    for (const u of users) { const e = String(u.email || "").toLowerCase(); if (e) emailCount[e] = (emailCount[e] || 0) + 1; }
    const dupEmails = Object.entries(emailCount).filter(([, n]) => n > 1).map(([e]) => e);
    const skuCount: Record<string, number> = {};
    for (const b of blocks) { const s = String(b.sku || ""); if (s) skuCount[s] = (skuCount[s] || 0) + 1; }
    const dupSkus = Object.entries(skuCount).filter(([, n]) => n > 1).map(([s]) => s);

    const publishedCount = blocks.filter((b) => b.status === "published").length;

    // VEREDITO PRÉ-CALCULADO — o modelo NÃO precisa (nem deve) recontar nada.
    // Cada item já vem com o número final e um booleano de "tem problema".
    const integrity_checks = {
      total_blocks: blocks.length,
      total_published_blocks: publishedCount,
      total_publications: publications.length,
      published_vs_publications_match: publishedCount === publications.length,
      orphan_publications_count: orphans.publicationsWithBadBlockId.length,
      orphan_publications_ids: orphans.publicationsWithBadBlockId,
      published_without_publication_count: orphans.publishedBlocksWithoutPub.length,
      published_without_publication_ids: orphans.publishedBlocksWithoutPub,
      tickets_bad_blockid_count: orphans.ticketsWithBadBlockId.length,
      blocks_bad_contractid_count: orphans.blocksWithBadContractId.length,
      blocks_bad_clientid_count: orphans.blocksWithBadClientId.length,
      contract_count_mismatches: contractMismatch, // já com diff calculado
      duplicate_emails: dupEmails,
      duplicate_skus: dupSkus,
      overdue_tickets_unassigned: overdueTickets.filter((t) => !t.assigned).map((t) => t.id),
    };

    // Resumo final enviado ao modelo
    const snapshot = {
      integrity_checks, // ← USE ESTES NÚMEROS. NÃO RECALCULE.
      counts: {
        clients: clients.length, contracts: contracts.length, blocks: blocks.length,
        publications: publications.length, tickets: tickets.length, users: users.length,
      },
      tickets_by_status: tickets.reduce<Record<string, number>>((acc, t) => { const s = String(t.status); acc[s] = (acc[s] || 0) + 1; return acc; }, {}),
    };

    const userPrompt = body.prompt
      ? `${body.prompt}\n\n---\nVEREDITO PRÉ-CALCULADO (NÃO recalcule, use estes valores):\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``
      : `Interprete o veredito de integridade abaixo. NÃO faça contas — os números já estão prontos. Reporte apenas checks com problema (contador > 0 ou array não-vazio):\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``;

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

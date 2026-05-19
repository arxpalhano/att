/**
 * POST /api/state/reseed
 *
 * Endpoint admin-only que apaga TODOS os dados das tabelas mutáveis
 * (blocks, publications, contracts, tickets, activities) e re-seeda
 * com os dados consolidados de seed.ts no SERVIDOR — sem depender
 * do browser/cache JS do admin.
 *
 * Inclui reconciliação automática de contadores de contrato
 * (usedBlocks = COUNT de blocos reais por contractId).
 */
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { MIGRATED_BLOCKS, MIGRATED_CONTRACTS, MIGRATED_PUBLICATIONS, MIGRATED_TICKETS } from "@/data/seed";
import { WJ_BLOCKS, WJ_PUBS } from "@/data/wj-seed";

export const dynamic = "force-dynamic";

// Dados originais do Portal.tsx (hardcoded para não importar Portal.tsx server-side)
const ORIGINAL_CONTRACTS = [
  { id: "ct1", clientId: "c1", title: "Contrato 2025 – Linha Completa", totalBlocks: 100, usedBlocks: 12, startDate: "2025-01-15", active: true },
  { id: "ct2", clientId: "c2", title: "Contrato Inicial – MVP", totalBlocks: 30, usedBlocks: 5, startDate: "2025-04-01", active: true },
  { id: "ct3", clientId: "c3", title: "Piloto Haus Concept", totalBlocks: 10, usedBlocks: 2, startDate: "2025-06-01", active: true },
  { id: "ct8", clientId: "c11", title: "Contrato WJ Luminárias 2025 – Linha Completa", totalBlocks: 21, usedBlocks: 20, startDate: "2025-10-01", active: true },
];

interface DataItem { id: string; contractId?: string; blockId?: string; [key: string]: unknown }

function getClient() {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.APP_AWS_REGION || "us-east-1" }), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

async function clearTable(doc: DynamoDBDocumentClient, table: string): Promise<number> {
  let total = 0;
  let last: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(new ScanCommand({ TableName: table, ProjectionExpression: "id", ExclusiveStartKey: last }));
    const items = (res.Items as unknown as DataItem[] | undefined) || [];
    for (const it of items) {
      await doc.send(new DeleteCommand({ TableName: table, Key: { id: it.id } }));
      total++;
    }
    last = res.LastEvaluatedKey;
  } while (last);
  return total;
}

async function putAll(doc: DynamoDBDocumentClient, table: string, items: DataItem[]): Promise<void> {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await doc.send(new BatchWriteCommand({
      RequestItems: { [table]: chunk.map((item) => ({ PutRequest: { Item: item } })) },
    }));
  }
}

export async function POST() {
  try {
    const doc = getClient();

    // 1. Construir dataset consolidado: WJ (21 blocos do Portal.tsx) + 107 migrados Notion/Excel
    const allBlocks = [...WJ_BLOCKS, ...MIGRATED_BLOCKS]; // 128 blocos no total
    const allPubs = [...WJ_PUBS, ...MIGRATED_PUBLICATIONS]; // 20 WJ + 46 = 66 pubs

    const allContracts = [...ORIGINAL_CONTRACTS, ...MIGRATED_CONTRACTS];
    // Recalcula usedBlocks de cada contrato com base nos blocos reais
    const reconciledContracts = allContracts.map((c) => {
      const real = allBlocks.filter((b) => b.contractId === c.id).length;
      return { ...c, usedBlocks: real, totalBlocks: Math.max(c.totalBlocks, real) };
    });

    // Filtra publicações órfãs
    const blockIdSet = new Set(allBlocks.map((b) => b.id));
    const validPubs = allPubs.filter((p) => blockIdSet.has(p.blockId));

    // 2. Limpar tabelas
    const cleared = {
      blocks: await clearTable(doc, "att-blocks"),
      publications: await clearTable(doc, "att-publications"),
      contracts: await clearTable(doc, "att-contracts"),
      tickets: await clearTable(doc, "att-tickets"),
      activities: await clearTable(doc, "att-activities"),
    };

    // 3. Reseed com dados consolidados
    await putAll(doc, "att-blocks", allBlocks as unknown as DataItem[]);
    await putAll(doc, "att-publications", validPubs as unknown as DataItem[]);
    await putAll(doc, "att-contracts", reconciledContracts as unknown as DataItem[]);
    await putAll(doc, "att-tickets", MIGRATED_TICKETS as unknown as DataItem[]);

    return NextResponse.json({
      ok: true,
      cleared,
      seeded: {
        blocks: allBlocks.length,
        publications: validPubs.length,
        publications_orphans_dropped: allPubs.length - validPubs.length,
        contracts: reconciledContracts.length,
        tickets: MIGRATED_TICKETS.length,
        activities: 0,
      },
      note: "Contadores de contrato reconciliados automaticamente (usedBlocks = COUNT real). Publicações órfãs descartadas.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

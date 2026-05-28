/**
 * POST /api/state/import-orphans
 *
 * Importa para o portal os customizadores publicados no S3 que ainda
 * NÃO têm bloco correspondente no DynamoDB. Para cada slug órfão:
 *  - Cria um bloco "published" (nome derivado do slug, última versão)
 *  - Cria a publication com URL + embed
 *  - Vincula ao contrato ativo do cliente (ou cria contrato genérico)
 *
 * Sempre usa a ÚLTIMA versão (ver-N máximo) de cada produto.
 * Idempotente: se rodar de novo, não duplica (verifica slug já existente).
 */
import { NextResponse } from "next/server";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

const S3_TO_CLIENT: Record<string, string> = {
  "escal": "c1", "estudio-bola": "c2", "wentz": "c3", "minnimal": "c4",
  "rs": "c5", "tidelli": "c6", "hunter-douglas": "c7", "docol": "c8",
  "pedro-franco": "c9", "dexco": "c10", "wj": "c11",
  "cadeiras-rosa2": "c13", "jader": "c14", "greenhouse": "c16", "ricco": "c18",
};

// Prefixo de SKU por cliente (para gerar SKUs consistentes)
const SKU_PREFIX: Record<string, string> = {
  c1: "ESCAL", c2: "EB", c3: "WENTZ", c4: "MN", c5: "RS", c6: "TIDELLI",
  c7: "HD", c8: "DOCOL", c9: "PF", c10: "DEXCO", c11: "WJ",
  c13: "CR", c14: "JA", c16: "GH", c18: "RICCO",
};

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}

function titleFromSlug(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function listPublishedInFolder(s3: S3Client, folder: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  let token: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: "explorar.archtechtour.com", Prefix: `${folder}/`, ContinuationToken: token,
    }));
    for (const obj of res.Contents || []) {
      const key = obj.Key || "";
      const m = key.match(new RegExp(`^${folder}/ver-(\\d+)/([^/]+)/index\\.html$`));
      if (m) {
        const ver = Number(m[1]); const slug = m[2];
        if (slug === "assets") continue;
        if (!result[slug] || result[slug] < ver) result[slug] = ver; // sempre última versão
      }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return result;
}

export async function POST() {
  const startedAt = Date.now();
  try {
    const region = process.env.APP_AWS_REGION || "us-east-1";
    const s3 = new S3Client({ region });
    const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });

    type Row = Record<string, unknown>;
    const blocks = ((await doc.send(new ScanCommand({ TableName: "att-blocks" }))).Items || []) as Row[];
    const contracts = ((await doc.send(new ScanCommand({ TableName: "att-contracts" }))).Items || []) as Row[];

    const newBlocks: Row[] = [];
    const newPubs: Row[] = [];
    const perClient: { client: string; imported: number; products: string[] }[] = [];

    for (const [folder, clientId] of Object.entries(S3_TO_CLIENT)) {
      const s3Published = await listPublishedInFolder(s3, folder);
      const clientBlocks = blocks.filter((b) => b.clientId === clientId);

      // Slugs já cobertos por blocos existentes (por título ou csku)
      const coveredSlugs = new Set<string>();
      for (const b of clientBlocks) {
        coveredSlugs.add(slugify(String(b.title || "")));
        coveredSlugs.add(slugify(String(b.csku || "")));
      }

      const contract = contracts.find((c) => c.clientId === clientId && c.active);
      const contractId = contract ? String(contract.id) : `ct_auto_${clientId}`;
      const prefix = SKU_PREFIX[clientId] || clientId.toUpperCase();

      let n = clientBlocks.length;
      const imported: string[] = [];

      for (const [slug, ver] of Object.entries(s3Published)) {
        const slugNorm = slug;
        // Pula se já há bloco que cobre esse slug
        const isCovered = coveredSlugs.has(slugNorm) ||
          Array.from(coveredSlugs).some((cs) => cs && (cs.includes(slugNorm) || slugNorm.includes(cs)));
        if (isCovered) continue;

        n++;
        const blockId = `pb_${clientId}_s3_${slug}`.slice(0, 80);
        const title = titleFromSlug(slug);
        const url = `https://explorar.archtechtour.com/${folder}/ver-${ver}/${slug}/index.html`;
        const embed = `<iframe width="100%" height="640px" frameborder="0" src="${url}" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>`;

        newBlocks.push({
          id: blockId, clientId, contractId, n,
          sku: `${prefix}-S3-${String(n).padStart(3, "0")}`,
          csku: slug.toUpperCase().replace(/-/g, " "),
          title, svc: "plus", status: "published", pri: "normal",
          owner: "u3", created: "2025-01-01", published: new Date().toISOString().slice(0, 10),
          _source: "s3-import",
        });
        newPubs.push({ id: `pub_${blockId}_v${ver}`, blockId, url, embed, env: "production", v: ver });
        coveredSlugs.add(slugNorm);
        imported.push(slug);
      }

      if (imported.length > 0) perClient.push({ client: clientId, imported: imported.length, products: imported });
    }

    // Dedup por id
    const uBlocks = Array.from(new Map(newBlocks.map((b) => [String(b.id), b])).values());
    const uPubs = Array.from(new Map(newPubs.map((p) => [String(p.id), p])).values());

    for (let i = 0; i < uBlocks.length; i += 25) {
      await doc.send(new BatchWriteCommand({ RequestItems: { "att-blocks": uBlocks.slice(i, i + 25).map((b) => ({ PutRequest: { Item: b } })) } }));
    }
    for (let i = 0; i < uPubs.length; i += 25) {
      await doc.send(new BatchWriteCommand({ RequestItems: { "att-publications": uPubs.slice(i, i + 25).map((p) => ({ PutRequest: { Item: p } })) } }));
    }

    // Recalcula usedBlocks dos contratos
    const blocks2 = ((await doc.send(new ScanCommand({ TableName: "att-blocks" }))).Items || []) as Row[];
    for (const c of contracts) {
      const real = blocks2.filter((b) => b.contractId === c.id).length;
      if (real !== c.usedBlocks) {
        await doc.send(new PutCommand({ TableName: "att-contracts", Item: { ...c, usedBlocks: real, totalBlocks: Math.max(Number(c.totalBlocks || 0), real) } }));
      }
    }

    return NextResponse.json({
      ok: true,
      totals: { blocksImported: uBlocks.length, publicationsCreated: uPubs.length },
      perClient,
      durationMs: Date.now() - startedAt,
      note: "Blocos criados a partir dos customizadores publicados no S3 (última versão de cada). Nome derivado do slug — admin pode renomear/ajustar SKU pela UI.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

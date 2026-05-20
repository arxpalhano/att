/**
 * POST /api/state/reconcile-publications
 *
 * Cruza o conteúdo do bucket S3 (explorar.archtechtour.com) com os
 * blocos do DynamoDB e:
 *  - Marca como "published" qualquer bloco cujo título corresponda
 *    a um customizador publicado no S3
 *  - Cria publication com URL e embed para cada bloco recém-publicado
 *  - Recalcula contract.usedBlocks (que já é feito via UI Provider)
 *
 * NÃO toca em blocos órfãos (publicações S3 sem bloco correspondente
 * no DynamoDB) — esses precisam ser criados manualmente pelo admin
 * (ou via outro endpoint), pois faltam metadados (SKU, contrato, etc).
 */
import { NextResponse } from "next/server";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

// Mapa folder no S3 → clientId no portal
const S3_TO_CLIENT: Record<string, string> = {
  "escal": "c1", "estudio-bola": "c2", "wentz": "c3", "minnimal": "c4",
  "rs": "c5", "tidelli": "c6", "hunter-douglas": "c7", "docol": "c8",
  "pedro-franco": "c9", "dexco": "c10", "wj": "c11",
  "cadeiras-rosa2": "c13", "jader": "c14", "greenhouse": "c16", "ricco": "c18",
};

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Lista index.html em /folder/ e retorna {slug: maxVer} */
async function listPublishedInFolder(s3: S3Client, folder: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  let continuationToken: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: "explorar.archtechtour.com",
      Prefix: `${folder}/`,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents || []) {
      const key = obj.Key || "";
      const m = key.match(new RegExp(`^${folder}/ver-(\\d+)/([^/]+)/index\\.html$`));
      if (m) {
        const ver = Number(m[1]);
        const slug = m[2];
        if (slug === "assets") continue;
        if (!result[slug] || result[slug] < ver) result[slug] = ver;
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return result;
}

export async function POST() {
  const startedAt = Date.now();
  try {
    const region = process.env.APP_AWS_REGION || "us-east-1";
    const s3 = new S3Client({ region });
    const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    });

    // 1. Lê todos os blocos do portal
    type Row = Record<string, unknown>;
    const blocksRes = await doc.send(new ScanCommand({ TableName: "att-blocks" }));
    const blocks = (blocksRes.Items || []) as Row[];
    const pubsRes = await doc.send(new ScanCommand({ TableName: "att-publications" }));
    const existingPubBlockIds = new Set((pubsRes.Items as Row[] || []).map((p) => String(p.blockId)));

    // 2. Para cada cliente, lista S3 e cruza com blocos do DynamoDB
    type ChangeResult = { client: string; blocksPublished: number; pubsCreated: number; unmatchedSlugs: string[] };
    const results: ChangeResult[] = [];
    const updatedBlocks: Row[] = [];
    const newPubs: Row[] = [];

    for (const [folder, clientId] of Object.entries(S3_TO_CLIENT)) {
      const s3Published = await listPublishedInFolder(s3, folder);
      const clientBlocks = blocks.filter((b) => b.clientId === clientId);
      const matched: string[] = [];
      let pubsCreated = 0;
      let blocksPublished = 0;

      for (const [slug, ver] of Object.entries(s3Published)) {
        // Procura bloco cujo título (slugificado) bata com o slug do S3
        const slugSet = new Set([slug, slug.replace(/-/g, "")]);
        const block = clientBlocks.find((b) => {
          const titleSlug = slugify(String(b.title || ""));
          const cskuSlug = slugify(String(b.csku || ""));
          return slugSet.has(titleSlug) || slugSet.has(cskuSlug) || titleSlug.includes(slug) || slug.includes(titleSlug);
        });
        if (!block) continue;
        matched.push(slug);

        const url = `https://explorar.archtechtour.com/${folder}/ver-${ver}/${slug}/index.html`;
        const embed = `<iframe width="100%" height="640px" frameborder="0" src="${url}" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>`;

        // Atualiza bloco se não estava published
        if (block.status !== "published") {
          const updated = { ...block, status: "published", published: new Date().toISOString().slice(0, 10) };
          updatedBlocks.push(updated);
          blocksPublished++;
        }

        // Cria publication se ainda não existe
        if (!existingPubBlockIds.has(String(block.id))) {
          newPubs.push({
            id: `pub_${block.id}_v${ver}`,
            blockId: block.id,
            url, embed, env: "production", v: ver,
          });
          pubsCreated++;
          existingPubBlockIds.add(String(block.id));
        }
      }

      const unmatched = Object.keys(s3Published).filter((s) => !matched.includes(s));
      results.push({ client: clientId, blocksPublished, pubsCreated, unmatchedSlugs: unmatched });
    }

    // 3. Dedup antes de escrever (mesma id pode aparecer 2x se 2 slugs S3 matchearem o mesmo bloco)
    const uniqueBlocks = Array.from(new Map(updatedBlocks.map((b) => [String(b.id), b])).values());
    const uniquePubs = Array.from(new Map(newPubs.map((p) => [String(p.id), p])).values());

    for (let i = 0; i < uniqueBlocks.length; i += 25) {
      const chunk = uniqueBlocks.slice(i, i + 25);
      await doc.send(new BatchWriteCommand({
        RequestItems: { "att-blocks": chunk.map((b) => ({ PutRequest: { Item: b } })) },
      }));
    }
    for (let i = 0; i < uniquePubs.length; i += 25) {
      const chunk = uniquePubs.slice(i, i + 25);
      await doc.send(new BatchWriteCommand({
        RequestItems: { "att-publications": chunk.map((p) => ({ PutRequest: { Item: p } })) },
      }));
    }

    // 4. Recalcula usedBlocks de cada contrato
    const contractsRes = await doc.send(new ScanCommand({ TableName: "att-contracts" }));
    const contracts = (contractsRes.Items || []) as Row[];
    // Refetch blocks (atualizados)
    const blocksRes2 = await doc.send(new ScanCommand({ TableName: "att-blocks" }));
    const blocks2 = (blocksRes2.Items || []) as Row[];
    for (const c of contracts) {
      const real = blocks2.filter((b) => b.contractId === c.id).length;
      if (real !== c.usedBlocks) {
        await doc.send(new PutCommand({
          TableName: "att-contracts",
          Item: { ...c, usedBlocks: real, totalBlocks: Math.max(Number(c.totalBlocks || 0), real) },
        }));
      }
    }

    const totals = {
      blocksUpdated: uniqueBlocks.length,
      publicationsCreated: uniquePubs.length,
      unmatchedTotal: results.reduce((s, r) => s + r.unmatchedSlugs.length, 0),
    };

    return NextResponse.json({
      ok: true,
      totals,
      perClient: results,
      durationMs: Date.now() - startedAt,
      note: "Publicações órfãs no S3 (sem bloco correspondente) ficam em 'unmatchedSlugs' — admin pode criar blocos manualmente para essas.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/instant/[id]
 *
 * Estado do job do ATT Instant. A página /experimentar/[id] faz polling aqui
 * enquanto o worker processa (fila → gerando → normalizando → avaliando → pronto).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
bootstrapAmplifyCredentials();

import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3 } from "@/lib/aws-clients";

const BUCKET = process.env.INSTANT_S3_BUCKET || "explorar.archtechtour.com";
const PREFIX = process.env.INSTANT_S3_PREFIX || "_instant";
const CDN = process.env.INSTANT_CDN || "https://explorar.archtechtour.com";

async function lerJson(key: string) {
  try {
    const res = await getS3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id.replace(/[^a-z0-9]/gi, "");
  if (!id) return NextResponse.json({ erro: "id inválido" }, { status: 400 });

  const base = `${PREFIX}/jobs/${id}`;
  const job = await lerJson(`${base}/job.json`);
  if (!job) {
    return NextResponse.json({ erro: "Teste não encontrado." }, { status: 404 });
  }

  const resultado = await lerJson(`${base}/resultado.json`);
  if (!resultado) {
    return NextResponse.json(
      { ...job, status: job.status || "fila" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // URLs públicas do que o cliente pode ver (o arquivo em si só sai com contrato)
  return NextResponse.json(
    {
      ...job,
      ...resultado,
      status: "pronto",
      glb_url: `${CDN}/${base}/saida/${job.slug}.glb`,
      usdz_url: resultado.usdz ? `${CDN}/${base}/saida/${job.slug}.usdz` : null,
      comparativo_url: `${CDN}/${base}/saida/comparativo.jpg`,
      foto_url: `${CDN}/${job.fotos?.[0] ?? ""}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

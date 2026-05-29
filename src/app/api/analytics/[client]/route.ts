/**
 * GET /api/analytics/[client]
 *
 * Fonte ÚNICA: S3 (analytics-cache/{alias}/latest.json), gerado pelo
 * refresh que roda queries reais no Athena. SEM fallback local —
 * todo dado exibido é 100% real do Athena. Sem cache = 404.
 *
 * Em produção (Amplify): IAM Role injeta credenciais → SDK resolve sozinho.
 * Em dev local: usa AWS_ACCESS_KEY_ID/SECRET do .env.local.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
bootstrapAmplifyCredentials();

import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3 } from "@/lib/aws-clients";

const ANALYTICS_BUCKET = process.env.ANALYTICS_S3_BUCKET || "archtechtour-assets";

export async function GET(
  _request: NextRequest,
  { params }: { params: { client: string } }
) {
  const alias = params.client.toLowerCase().replace(/[^a-z0-9]/g, "");

  // ÚNICA fonte: S3 analytics-cache (gerado pelo refresh → Athena → S3).
  // SEM fallback local: dados precisam ser 100% reais do Athena.
  // Se não houver cache, retorna 404 e o cliente vê "gere o relatório".
  try {
    const cmd = new GetObjectCommand({
      Bucket: ANALYTICS_BUCKET,
      Key: `analytics-cache/${alias}/latest.json`,
    });
    const res = await getS3().send(cmd);
    const body = await res.Body?.transformToString();
    if (body) {
      return NextResponse.json(JSON.parse(body), {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    }
    return NextResponse.json(
      { error: "Dados de analytics ainda não gerados para este cliente. Clique em Atualizar." },
      { status: 404 }
    );
  } catch {
    return NextResponse.json(
      { error: "Dados de analytics ainda não gerados para este cliente. Clique em Atualizar." },
      { status: 404 }
    );
  }
}

/**
 * GET /api/analytics/[client]
 *
 * Ordem de leitura:
 *   1. S3 (analytics-cache/{alias}/latest.json) — fonte de verdade em produção
 *   2. Fallback: arquivo local em /public/analytics-data/{alias}.json (dev)
 *
 * Em produção (Amplify): IAM Role injeta credenciais → SDK resolve sozinho.
 * Em dev local: usa AWS_ACCESS_KEY_ID/SECRET do .env.local.
 */
import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3 } from "@/lib/aws-clients";
import path from "path";
import fs from "fs";

const ANALYTICS_BUCKET = process.env.ANALYTICS_S3_BUCKET || "archtechtour-assets";

export async function GET(
  _request: NextRequest,
  { params }: { params: { client: string } }
) {
  const alias = params.client.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. S3
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
  } catch {
    // continua para fallback
  }

  // 2. Fallback local (dev)
  try {
    const filePath = path.join(process.cwd(), "public", "analytics-data", `${alias}.json`);
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(content), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "Dados de analytics não disponíveis para este cliente." },
      { status: 404 }
    );
  }
}

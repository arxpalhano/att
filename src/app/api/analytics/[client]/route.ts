/**
 * API Route: /api/analytics/[client]
 * Retorna os dados de analytics de um cliente.
 *
 * Lógica:
 *   1. Tenta ler o JSON pré-computado do S3 (analytics-cache/{alias}/latest.json)
 *   2. Fallback: lê o arquivo local em /public/analytics-data/{alias}.json
 *
 * Env vars necessárias (.env.local):
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   ANALYTICS_S3_BUCKET  → bucket onde a Lambda salva os JSONs (ex: archtechtour-assets)
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import fs from "fs";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const ANALYTICS_BUCKET = process.env.ANALYTICS_S3_BUCKET || "archtechtour-assets";

export async function GET(
  _request: NextRequest,
  { params }: { params: { client: string } }
) {
  const alias = params.client.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Tentar S3
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const cmd = new GetObjectCommand({
        Bucket: ANALYTICS_BUCKET,
        Key: `analytics-cache/${alias}/latest.json`,
      });
      const res = await s3.send(cmd);
      const body = await res.Body?.transformToString();
      if (body) {
        return NextResponse.json(JSON.parse(body), {
          headers: { "Cache-Control": "public, max-age=3600" },
        });
      }
    } catch {
      // S3 indisponível ou arquivo não existe → continua para fallback
    }
  }

  // 2. Fallback: arquivo local
  try {
    const filePath = path.join(process.cwd(), "public", "analytics-data", `${alias}.json`);
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(content), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Dados de analytics não disponíveis para este cliente." },
      { status: 404 }
    );
  }
}

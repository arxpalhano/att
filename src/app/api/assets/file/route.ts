/**
 * Download/abertura dos arquivos de bloco no S3 (prefixo clientes/ do bucket
 * archtechtour-assets). GET ?key=…&name=…[&inline=1] → redireciona para URL
 * assinada de 15 min. O link do portal é estável; o assinado expira.
 */
import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
import { getS3 } from "@/lib/aws-clients";

bootstrapAmplifyCredentials();

export const dynamic = "force-dynamic";

const BUCKET = process.env.S3_BUCKET_NAME || "archtechtour-assets";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const name = req.nextUrl.searchParams.get("name") || key?.split("/").pop() || "arquivo";
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  if (!key || !key.startsWith("clientes/") || key.includes("..") || key.length > 512) {
    return NextResponse.json({ error: "key inválida" }, { status: 400 });
  }
  try {
    const url = await getSignedUrl(
      getS3(),
      new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}` }),
      { expiresIn: 900 },
    );
    return NextResponse.redirect(url, 302);
  } catch (err) {
    console.error("[assets file]", err);
    return NextResponse.json({ error: "Não foi possível gerar o link do arquivo." }, { status: 500 });
  }
}

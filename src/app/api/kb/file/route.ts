/**
 * Anexos da KB no S3 (prefixo kb/ do bucket archtechtour-assets).
 *
 * GET    /api/kb/file?key=kb/...&name=...  → redireciona para URL assinada (15 min).
 *        A URL do portal é estável (pode ir num link do artigo); a assinada expira.
 * DELETE /api/kb/file?key=kb/...           → remove o objeto.
 *
 * Só aceita chaves que começam com `kb/` — nada de ler outros prefixos do bucket.
 */
import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
import { getS3 } from "@/lib/aws-clients";

bootstrapAmplifyCredentials();

export const dynamic = "force-dynamic";

const BUCKET = process.env.S3_BUCKET_NAME || "archtechtour-assets";

function validKey(key: string | null): key is string {
  return !!key && key.startsWith("kb/") && !key.includes("..") && key.length < 512;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const name = req.nextUrl.searchParams.get("name") || key?.split("/").pop() || "arquivo";
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  if (!validKey(key)) return NextResponse.json({ error: "key inválida" }, { status: 400 });
  try {
    const url = await getSignedUrl(
      getS3(),
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      }),
      { expiresIn: 900 },
    );
    return NextResponse.redirect(url, 302);
  } catch (err) {
    console.error("[KB file]", err);
    return NextResponse.json({ error: "Não foi possível gerar o link do arquivo." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!validKey(key)) return NextResponse.json({ error: "key inválida" }, { status: 400 });
  try {
    await getS3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[KB file delete]", err);
    return NextResponse.json({ error: "Não foi possível remover o arquivo." }, { status: 500 });
  }
}

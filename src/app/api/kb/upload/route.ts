/**
 * POST /api/kb/upload — URL pré-assinada para anexar um arquivo a um artigo da KB.
 * O browser envia direto ao S3 (bucket archtechtour-assets, prefixo kb/).
 * Body: { fileName, fileType, size, baseId, articleId }
 */
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
import { getS3 } from "@/lib/aws-clients";
import { KB_ALLOWED_EXTENSIONS, KB_MAX_FILE_MB, kbExt } from "@/lib/kb";

bootstrapAmplifyCredentials();

export const dynamic = "force-dynamic";

const BUCKET = process.env.S3_BUCKET_NAME || "archtechtour-assets";
const SAFE_ID = /^[a-zA-Z0-9_-]{1,64}$/;

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType, size, baseId, articleId } = await req.json();
    if (!fileName || !baseId || !articleId) {
      return NextResponse.json({ error: "Campos obrigatórios: fileName, baseId, articleId" }, { status: 400 });
    }
    if (!SAFE_ID.test(baseId) || !SAFE_ID.test(articleId)) {
      return NextResponse.json({ error: "baseId/articleId inválidos" }, { status: 400 });
    }
    const ext = kbExt(fileName);
    if (!KB_ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Extensão "${ext || "(sem extensão)"}" não permitida.` }, { status: 400 });
    }
    if (typeof size === "number" && size > KB_MAX_FILE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Arquivo acima de ${KB_MAX_FILE_MB} MB.` }, { status: 400 });
    }

    const sanitized = String(fileName)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
    const key = `kb/${baseId}/${articleId}/${Date.now()}_${sanitized}`;
    const contentType = fileType || "application/octet-stream";

    const uploadUrl = await getSignedUrl(
      getS3(),
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, Metadata: { baseId, articleId, originalName: encodeURIComponent(fileName) } }),
      { expiresIn: 600 },
    );
    return NextResponse.json({ uploadUrl, key, contentType });
  } catch (err) {
    console.error("[KB upload]", err);
    return NextResponse.json({ error: "Erro ao gerar URL de upload." }, { status: 500 });
  }
}

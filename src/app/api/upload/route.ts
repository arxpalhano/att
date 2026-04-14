/**
 * API Route: /api/upload
 * Gera uma URL pré-assinada do S3 para upload direto pelo browser.
 * O cliente nunca envia arquivos para o nosso servidor — vai direto ao S3.
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   AWS_REGION=us-east-1
 *   AWS_ACCESS_KEY_ID=sua_access_key
 *   AWS_SECRET_ACCESS_KEY=sua_secret_key
 *   S3_BUCKET_NAME=archtechtour-assets
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.S3_BUCKET_NAME || "archtechtour-assets";

// Extensões permitidas por categoria
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  cad: [".step", ".stp", ".dwg", ".dxf", ".iges", ".igs"],
  finishing: [".pdf", ".png", ".jpg", ".jpeg"],
  photos: [".jpg", ".jpeg", ".png", ".webp", ".tiff"],
  videos: [".mp4", ".mov", ".avi", ".mkv"],
  technical_drawing: [".pdf", ".dwg", ".dxf"],
  "3d_block": [".glb", ".gltf", ".obj", ".fbx"],
  extra_reference: [".pdf", ".png", ".jpg", ".jpeg", ".zip"],
};

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType, category, blockId, clientId } = await req.json();

    if (!fileName || !fileType || !category || !blockId || !clientId) {
      return NextResponse.json({ error: "Campos obrigatórios: fileName, fileType, category, blockId, clientId" }, { status: 400 });
    }

    // Validar extensão
    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    const allowed = ALLOWED_EXTENSIONS[category];
    if (allowed && !allowed.includes(ext)) {
      return NextResponse.json({
        error: `Extensão "${ext}" não permitida para categoria "${category}". Permitidas: ${allowed.join(", ")}`
      }, { status: 400 });
    }

    // Organizar no S3: clientes/{clientId}/blocos/{blockId}/{categoria}/{timestamp}_{arquivo}
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `clientes/${clientId}/blocos/${blockId}/${category}/${timestamp}_${sanitizedName}`;

    // Gerar URL pré-assinada para PUT (upload direto)
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: fileType,
      Metadata: {
        blockId,
        clientId,
        category,
        originalName: fileName,
      },
    });

    const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 300 }); // 5 minutos

    // Gerar URL pré-assinada para GET (leitura do arquivo depois do upload)
    const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const readUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 * 24 }); // 24h

    return NextResponse.json({
      uploadUrl,
      readUrl,
      key,
      expiresIn: 300,
    });
  } catch (err) {
    console.error("[S3 Upload Error]", err);
    return NextResponse.json({ error: "Erro ao gerar URL de upload. Verifique as credenciais AWS." }, { status: 500 });
  }
}

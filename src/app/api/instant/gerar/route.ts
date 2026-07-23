/**
 * POST /api/instant/gerar
 *
 * Recebe as fotos + medidas do formulário público /experimentar, grava o job
 * no S3 e devolve o id. O worker (máquina de processamento com Blender) faz
 * polling da fila, roda a geração e escreve o resultado de volta no S3.
 *
 * O Next.js na Amplify não roda Blender — por isso o desenho fila + worker.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
bootstrapAmplifyCredentials();

import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3 } from "@/lib/aws-clients";
import { CATEGORIAS } from "@/lib/instant-categorias";

const BUCKET = process.env.INSTANT_S3_BUCKET || "explorar.archtechtour.com";
const PREFIX = process.env.INSTANT_S3_PREFIX || "_instant";
const MAX_FOTO_MB = 12;

function novoId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(s: string) {
  return (s || "produto")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "produto";
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const categoriaId = String(form.get("categoria") || "");
    const categoria = CATEGORIAS.find((c) => c.id === categoriaId);

    if (!categoria) {
      return NextResponse.json({ erro: "Categoria inválida." }, { status: 400 });
    }
    if (!categoria.automatico) {
      // Não gastamos geração no que sabemos que a IA não entrega.
      return NextResponse.json(
        { erro: "Esta categoria exige modelagem artesanal.", rota: "artesanal" },
        { status: 422 },
      );
    }

    const fotos = form.getAll("fotos").filter((f): f is File => f instanceof File);
    if (fotos.length === 0) {
      return NextResponse.json({ erro: "Envie pelo menos uma foto." }, { status: 400 });
    }
    for (const f of fotos) {
      if (f.size > MAX_FOTO_MB * 1024 * 1024) {
        return NextResponse.json(
          { erro: `Cada foto deve ter até ${MAX_FOTO_MB} MB.` },
          { status: 413 },
        );
      }
    }

    const id = novoId();
    const slug = `${slugify(String(form.get("marca") || ""))}-${slugify(String(form.get("produto") || ""))}`
      .replace(/^-/, "")
      .slice(0, 64);
    const s3 = getS3();
    const base = `${PREFIX}/jobs/${id}`;

    const nomes: string[] = [];
    const aSalvar = fotos.slice(0, 4);
    for (let i = 0; i < aSalvar.length; i++) {
      const foto = aSalvar[i];
      const ext = foto.name.split(".").pop()?.toLowerCase() || "jpg";
      const key = `${base}/entrada/foto-${i + 1}.${ext}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: Buffer.from(await foto.arrayBuffer()),
          ContentType: foto.type || "image/jpeg",
        }),
      );
      nomes.push(key);
    }

    const job = {
      id,
      slug,
      status: "fila",
      criado_em: new Date().toISOString(),
      categoria: categoria.id,
      categoria_rotulo: categoria.rotulo,
      aviso_categoria: categoria.aviso ?? null,
      produto: String(form.get("produto") || ""),
      marca: String(form.get("marca") || ""),
      dimensoes: {
        altura: Number(form.get("altura")) || null,
        largura: Number(form.get("largura")) || null,
        profundidade: Number(form.get("profundidade")) || null,
      },
      fotos: nomes,
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${base}/job.json`,
        Body: JSON.stringify(job, null, 2),
        ContentType: "application/json; charset=utf-8",
      }),
    );

    return NextResponse.json({ id, status: "fila" }, { status: 202 });
  } catch (e) {
    console.error("[instant/gerar]", e);
    return NextResponse.json(
      { erro: "Não foi possível iniciar a geração. Tente novamente." },
      { status: 500 },
    );
  }
}

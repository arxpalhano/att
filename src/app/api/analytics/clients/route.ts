/**
 * GET  /api/analytics/clients
 *   → lista todos os clientes da dim_client_alias com flag de "tem JSON salvo"
 *
 * POST /api/analytics/clients
 *   Body: { alias: "novocli", cliente: "Nome do Cliente" }
 *   → INSERT INTO dim_client_alias
 */
import { NextRequest, NextResponse } from "next/server";
import { runAthenaQuery, sqlEscape } from "@/lib/athena";
import fs from "fs";
import path from "path";

export const maxDuration = 30;

const ATHENA_DB = process.env.ATHENA_DB || "customizador_events";

export async function GET() {
  try {
    const rows = await runAthenaQuery(
      `SELECT alias, cliente FROM ${ATHENA_DB}.dim_client_alias ORDER BY cliente`
    );

    const localDir = path.join(process.cwd(), "public", "analytics-data");
    const localFiles = fs.existsSync(localDir) ? fs.readdirSync(localDir) : [];

    const clients = rows.map((r) => {
      const alias = r.alias.toLowerCase();
      const fileName = `${alias}.json`;
      const localPath = path.join(localDir, fileName);
      let last_updated: string | null = null;
      let periodo: { inicio: string; fim: string } | null = null;
      if (localFiles.includes(fileName)) {
        try {
          const content = JSON.parse(fs.readFileSync(localPath, "utf-8"));
          last_updated = content.gerado_em || null;
          periodo = content.periodo ? { inicio: content.periodo.inicio, fim: content.periodo.fim } : null;
        } catch {
          // ignore
        }
      }
      return { alias, cliente: r.cliente, has_data: !!last_updated, last_updated, periodo };
    });

    return NextResponse.json({ clients });
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao listar clientes: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { alias, cliente } = body as { alias?: string; cliente?: string };

  if (!alias || !cliente) {
    return NextResponse.json(
      { error: "Body inválido. Esperado: { alias, cliente }" },
      { status: 400 }
    );
  }

  const aliasClean = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!aliasClean || !/^[a-z0-9]{2,30}$/.test(aliasClean)) {
    return NextResponse.json(
      { error: "Alias inválido. Use letras minúsculas e números, 2-30 chars." },
      { status: 400 }
    );
  }

  try {
    // Checa se já existe
    const existing = await runAthenaQuery(
      `SELECT alias FROM ${ATHENA_DB}.dim_client_alias WHERE LOWER(alias) = '${sqlEscape(aliasClean)}' LIMIT 1`
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: `Alias '${aliasClean}' já existe` }, { status: 409 });
    }

    await runAthenaQuery(
      `INSERT INTO ${ATHENA_DB}.dim_client_alias (alias, cliente) VALUES ('${sqlEscape(aliasClean)}', '${sqlEscape(cliente)}')`
    );

    return NextResponse.json({ alias: aliasClean, cliente, created: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao inserir cliente: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/[client]/refresh
 *
 * Body: { inicio: "YYYY-MM-DD", fim: "YYYY-MM-DD" }
 * Roda as queries Athena pro cliente no range pedido, salva o JSON
 * (S3 se ANALYTICS_S3_BUCKET; sempre local) e retorna o JSON.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
bootstrapAmplifyCredentials();

import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics, saveAnalytics } from "@/lib/analytics-builder";
import { runAthenaQuery, sqlEscape } from "@/lib/athena";

export const maxDuration = 60; // segundos (Vercel hobby limit é 10s — pro/enterprise OK)

export async function POST(
  request: NextRequest,
  { params }: { params: { client: string } }
) {
  // Auth: em produção exige header com secret. Em dev, aberto.
  const expectedSecret = process.env.ANALYTICS_REFRESH_SECRET;
  if (expectedSecret) {
    const provided =
      request.headers.get("x-analytics-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const alias = params.client.toLowerCase().replace(/[^a-z0-9]/g, "");
  const body = await request.json().catch(() => ({}));
  const { inicio, fim } = body as { inicio?: string; fim?: string };

  if (!inicio || !fim || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return NextResponse.json(
      { error: "Body inválido. Esperado: { inicio: 'YYYY-MM-DD', fim: 'YYYY-MM-DD' }" },
      { status: 400 }
    );
  }
  if (inicio > fim) {
    return NextResponse.json({ error: "inicio > fim" }, { status: 400 });
  }

  // Busca o nome do cliente pela dim
  let cliente = "";
  try {
    const rows = await runAthenaQuery(
      `SELECT cliente FROM customizador_events.dim_client_alias WHERE LOWER(alias) = '${sqlEscape(alias)}' LIMIT 1`
    );
    cliente = rows[0]?.cliente || "";
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao consultar dim_client_alias: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  if (!cliente) {
    return NextResponse.json(
      { error: `Alias '${alias}' não existe em dim_client_alias. Adicione o cliente primeiro.` },
      { status: 404 }
    );
  }

  try {
    const data = await buildAnalytics({ cliente, alias, inicio, fim });
    await saveAnalytics(alias, data);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Falha no refresh: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

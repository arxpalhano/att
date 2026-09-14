/**
 * Leitura do log de atividades (tabela att-activities).
 *
 * GET ?days=90            → { items } (0 ou ausente = tudo), mais recentes primeiro.
 * POST                    → NÃO grava. O log é escrito só pelo servidor
 *                           (delta das rotas de estado) e por /api/activity.
 *                           Um browser com JS antigo ainda pode mandar o array
 *                           inteiro aqui; ignoramos para não ressuscitar o seed.
 */
import { NextRequest, NextResponse } from "next/server";
import { listActivities } from "@/lib/activity-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get("days") ?? "90");
    const items = await listActivities({ days: Number.isFinite(days) ? days : 90 });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ ok: true, ignored: true, reason: "o log é gravado pelo servidor; use /api/activity" });
}

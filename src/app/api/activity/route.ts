/**
 * Log de atividades — eventos que não passam pelas tabelas de estado.
 *
 * POST { type, entity, desc, blockId?, clientId?, entityId?, entityLabel?, page? }
 *      → carimba hora do servidor + quem fez (cabeçalho x-att-actor + e-mail da
 *        sessão Microsoft) e grava. Devolve { ok, activity }.
 *        Usado para: login, logout, page_view, asset_uploaded, agent_run,
 *        agent_config, analytics_refresh.
 *
 * GET ?days=30&user=<id>&entity=<entidade>&client=<clientId>
 *      → { items } mais recentes primeiro (days=0 = tudo).
 */
import { NextRequest, NextResponse } from "next/server";
import { listActivities, readActor, writeActivities } from "@/lib/activity-server";
import { ActivityEntity, ENTITY_LABELS } from "@/lib/activity";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["login", "logout", "page_view", "asset_uploaded", "agent_run", "agent_config", "analytics_refresh"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body?.type ?? "");
    const entity = String(body?.entity ?? "") as ActivityEntity;
    const desc = String(body?.desc ?? "").slice(0, 500);
    if (!ALLOWED_TYPES.has(type)) return NextResponse.json({ error: `type inválido: ${type}` }, { status: 400 });
    if (!(entity in ENTITY_LABELS)) return NextResponse.json({ error: `entity inválida: ${entity}` }, { status: 400 });
    if (!desc) return NextResponse.json({ error: "desc obrigatório" }, { status: 400 });
    const { actor, sessionEmail } = await readActor(req);
    if (actor.id === "anon") return NextResponse.json({ error: "sem usuário (cabeçalho x-att-actor ausente)" }, { status: 400 });
    const [activity] = await writeActivities([{
      type, entity, desc,
      blockId: typeof body.blockId === "string" ? body.blockId : "",
      clientId: typeof body.clientId === "string" ? body.clientId : undefined,
      entityId: typeof body.entityId === "string" ? body.entityId : undefined,
      entityLabel: typeof body.entityLabel === "string" ? body.entityLabel : undefined,
    }], actor, sessionEmail, "client");
    if (typeof body.page === "string") activity.page = body.page;
    return NextResponse.json({ ok: true, activity });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const days = Number(q.get("days") ?? "30");
    const items = await listActivities({
      days: Number.isFinite(days) ? days : 30,
      userId: q.get("user") || undefined,
      entity: q.get("entity") || undefined,
      clientId: q.get("client") || undefined,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

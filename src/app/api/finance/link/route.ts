/**
 * POST /api/finance/link { asaasId, clientId | null } → vincula (ou desvincula) um
 * cliente do Asaas a uma marca do portal. Vínculo manual nunca é sobrescrito pelo sync.
 * Registra `finance_link` no log.
 */
import { NextRequest, NextResponse } from "next/server";
import { readActor, writeActivities } from "@/lib/activity-server";
import { linkCustomer } from "@/lib/finance-server";
import { getItem, TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { actor, sessionEmail } = await readActor(req);
    if (actor.id === "anon") return NextResponse.json({ error: "sem usuário" }, { status: 401 });
    if (actor.role === "client" || actor.role === "freelancer_bim") return NextResponse.json({ error: "sem acesso" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const asaasId = String(body?.asaasId || "");
    const clientId = body?.clientId ? String(body.clientId) : null;
    if (!asaasId) return NextResponse.json({ error: "asaasId obrigatório" }, { status: 400 });
    const customer = await linkCustomer(asaasId, clientId);
    const client = clientId ? await getItem<{ id: string; name: string }>(TABLES.CLIENTS, clientId) : null;
    await writeActivities([{
      type: "finance_link", entity: "finance", blockId: "", clientId: clientId ?? undefined, entityId: asaasId, entityLabel: customer.name,
      desc: clientId ? `Cliente Asaas "${customer.name}" vinculado à marca ${client?.name ?? clientId}` : `Cliente Asaas "${customer.name}" desvinculado`,
    }], actor, sessionEmail, "server").catch(() => undefined);
    return NextResponse.json({ ok: true, customer });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

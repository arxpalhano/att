/**
 * POST /api/finance/sync → sincronização completa Asaas → att-finance.
 *
 * Quem pode chamar:
 *   - pessoa logada da equipe interna (cabeçalho x-att-actor; a tela checa o perfil)
 *   - o cron (EventBridge → API destination) com `x-finance-secret: FINANCE_SYNC_SECRET`
 *     ou `?secret=`.
 * Registra `finance_sync` no log de atividades.
 */
import { NextRequest, NextResponse } from "next/server";
import { readActor, writeActivities } from "@/lib/activity-server";
import { syncFromAsaas } from "@/lib/finance-server";
import { asaasConfigured } from "@/lib/asaas";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    if (!asaasConfigured()) return NextResponse.json({ error: "ASAAS_API_KEY não configurada no ambiente" }, { status: 503 });
    const secret = process.env.FINANCE_SYNC_SECRET;
    const given = req.headers.get("x-finance-secret") || req.nextUrl.searchParams.get("secret") || "";
    const byCron = !!secret && given === secret;
    const { actor, sessionEmail } = await readActor(req);
    if (!byCron) {
      if (actor.id === "anon") return NextResponse.json({ error: "sem usuário" }, { status: 401 });
      if (actor.role === "client" || actor.role === "freelancer_bim") return NextResponse.json({ error: "sem acesso" }, { status: 403 });
    }
    const who = byCron ? "cron" : actor.name;
    const result = await syncFromAsaas(who);
    const c = result.counts;
    await writeActivities([{
      type: "finance_sync", entity: "finance", blockId: "",
      desc: `Financeiro sincronizado com o Asaas (${result.env}): ${c.customers} clientes, ${c.payments} cobranças, ${c.subscriptions} assinaturas, ${c.invoices} notas${result.removed ? `, ${result.removed} removido(s)` : ""} · ${(result.ms / 1000).toFixed(1)}s`,
    }], byCron ? { id: "cron", name: "Rotina diária", role: "system" } : actor, sessionEmail, "server").catch(() => undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

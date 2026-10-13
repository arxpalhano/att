/**
 * POST /api/finance/webhook → o Asaas chama aqui a cada evento (cobrança, assinatura, nota).
 *
 * Regras do Asaas (docs.asaas.com → Webhooks):
 *   - valida `asaas-access-token` == ASAAS_WEBHOOK_TOKEN (configurado ao criar o webhook)
 *   - responde 200 rápido; entrega "pelo menos uma vez" → idempotência pelo `id` do evento
 *     (src/lib/finance-server.ts applyWebhookEvent)
 *   - 15 falhas seguidas pausam a fila no Asaas → nunca devolver 5xx por erro nosso de
 *     processamento; grava o erro no meta e devolve 200.
 *   - campos novos podem aparecer: ignorar, nunca quebrar.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyWebhookEvent } from "@/lib/finance-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: "webhook não configurado" }, { status: 503 });
  const given = req.headers.get("asaas-access-token") || "";
  if (given !== expected) return NextResponse.json({ error: "token inválido" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  try {
    const done = await applyWebhookEvent(body as Parameters<typeof applyWebhookEvent>[0]);
    return NextResponse.json({ received: true, done });
  } catch (e) {
    console.error("[finance/webhook]", (e as Error).message);
    return NextResponse.json({ received: true, error: (e as Error).message });
  }
}

/** O Asaas (e gente testando) às vezes faz GET na URL: responde algo amigável. */
export async function GET() {
  return NextResponse.json({ ok: true, hint: "Endpoint de webhook do Asaas — use POST com o header asaas-access-token." });
}

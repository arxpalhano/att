/**
 * POST /api/kb/unlock — confere a senha de uma base protegida.
 * Body: { baseId, password } → { ok: true } ou 401.
 */
import { NextRequest, NextResponse } from "next/server";
import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
import { getItem, TABLES } from "@/lib/dynamo";
import { verifyKbPassword } from "@/lib/kb-password";
import type { KbBase } from "@/lib/kb";

bootstrapAmplifyCredentials();

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { baseId, password } = await req.json();
    if (!baseId || typeof password !== "string") return NextResponse.json({ error: "baseId e password obrigatórios" }, { status: 400 });
    const base = await getItem<KbBase>(TABLES.KB, baseId);
    if (!base || base.kind !== "base") return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
    if (!verifyKbPassword(password, base.passwordHash)) return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

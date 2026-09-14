/**
 * Base de Conhecimento — bases e artigos (tabela att-kb).
 * Mesmo contrato das outras rotas de estado: GET lista tudo; POST com array =
 * replaceAll (só o seed usa), com objeto = upsert de um item; DELETE ?id= remove.
 * Upsert e DELETE registram no log de atividades (att-activities).
 *
 * A KB grava POR ITEM de propósito: o corpo dos artigos é grande e dois editores
 * gravando a tabela inteira (replaceAll) se sobrescreveriam.
 */
import { NextRequest, NextResponse } from "next/server";
import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
import { scanAll, putItem, replaceAll, deleteItem, getItem, TABLES } from "@/lib/dynamo";
import { readActor, writeActivities } from "@/lib/activity-server";
import { describeChange } from "@/lib/activity";
import { hashKbPassword } from "@/lib/kb-password";
import type { KbBase, KbRecord } from "@/lib/kb";

/** O hash da senha nunca sai do servidor: a tela só recebe `locked`. */
const publicView = (r: KbRecord): KbRecord =>
  r.kind === "base" ? ({ ...r, passwordHash: undefined, locked: !!(r as KbBase).passwordHash } as KbBase) : r;

bootstrapAmplifyCredentials();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = (await scanAll<KbRecord>(TABLES.KB)).map(publicView);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      await replaceAll(TABLES.KB, body);
      return NextResponse.json({ ok: true, count: body.length });
    }
    if (!body?.id || (body.kind !== "base" && body.kind !== "article")) {
      return NextResponse.json({ error: "Registro inválido: precisa de id e kind (base|article)" }, { status: 400 });
    }
    if (body.kind === "base") {
      // Senha: `password` define/troca (vira hash), `clearPassword` remove; sem
      // nenhum dos dois, preserva o hash que já está no banco (a tela não o tem).
      const { password, clearPassword, locked: _locked, passwordHash: _ignored, ...rest } = body;
      const existing = await getItem<KbBase>(TABLES.KB, rest.id);
      const passwordHash = clearPassword ? undefined
        : typeof password === "string" && password.length > 0 ? hashKbPassword(password)
        : existing?.passwordHash;
      const rec: KbBase = { ...rest, ...(passwordHash ? { passwordHash } : {}) };
      await putItem(TABLES.KB, rec);
      const { actor, sessionEmail } = await readActor(req);
      const activities = await writeActivities(describeChange("kb", existing, rec, actor), actor, sessionEmail, "server");
      return NextResponse.json({ ok: true, locked: !!passwordHash, activities });
    }
    const before = await getItem<KbRecord>(TABLES.KB, body.id);
    await putItem(TABLES.KB, body);
    const { actor, sessionEmail } = await readActor(req);
    const activities = await writeActivities(describeChange("kb", before, body, actor), actor, sessionEmail, "server");
    return NextResponse.json({ ok: true, activities });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const before = await getItem<KbRecord>(TABLES.KB, id);
    await deleteItem(TABLES.KB, id);
    const { actor, sessionEmail } = await readActor(req);
    const activities = before ? await writeActivities(describeChange("kb", before, null, actor), actor, sessionEmail, "server") : [];
    return NextResponse.json({ ok: true, activities });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

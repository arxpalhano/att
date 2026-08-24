/**
 * Rotina do Argus Watchtower — horários, destinatários e alvos monitorados.
 * GET → rotina atual (ou o default, se ainda não foi salva)
 * PUT → salva a rotina editada no portal (validada por `sanitizeRoutine`)
 *
 * A Lambda `site-watchdog` lê exatamente este item a cada hora, então salvar
 * aqui já muda o agendamento — não há nada pra redeployar.
 */
import { NextRequest, NextResponse } from "next/server";
import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
import { getItem, putItem, TABLES } from "@/lib/dynamo";
import { ARGUS_ROUTINE_ID, DEFAULT_ROUTINE, WatchdogRoutine, sanitizeRoutine } from "@/lib/watchdog";

bootstrapAmplifyCredentials();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const saved = await getItem<WatchdogRoutine>(TABLES.AGENT_ROUTINES, ARGUS_ROUTINE_ID);
    return NextResponse.json({ routine: saved ? { ...DEFAULT_ROUTINE, ...saved } : DEFAULT_ROUTINE, saved: !!saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await getItem<WatchdogRoutine>(TABLES.AGENT_ROUTINES, ARGUS_ROUTINE_ID);
    const base = saved ? { ...DEFAULT_ROUTINE, ...saved } : DEFAULT_ROUTINE;
    const routine = sanitizeRoutine(body, base);
    await putItem(TABLES.AGENT_ROUTINES, routine);
    return NextResponse.json({ ok: true, routine });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

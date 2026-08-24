/**
 * Agente: Argus Watchtower — monitor de disponibilidade dos sites da ATT.
 *
 * GET  → rotina salva + histórico das últimas verificações (para a tela do portal)
 * POST → roda uma verificação AGORA (manual), grava no histórico e, conforme a
 *        rotina, dispara o e-mail. Body opcional: { sendEmail?: boolean }
 *
 * O agendamento (13h/21h) NÃO passa por aqui: quem roda é a Lambda
 * `site-watchdog`, de hora em hora, lendo a mesma rotina no DynamoDB. Assim o
 * monitoramento sobrevive a uma queda do próprio portal.
 */
import { NextRequest, NextResponse } from "next/server";
import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
import { getItem, putItem, scanAll, TABLES } from "@/lib/dynamo";
import { sendEmail } from "@/lib/mailer";
import {
  ARGUS_ROUTINE_ID, DEFAULT_ROUTINE, WatchdogCheck, WatchdogRoutine,
  buildEmail, nowInSaoPaulo, runProbes,
} from "@/lib/watchdog";

bootstrapAmplifyCredentials();

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 40;

async function loadRoutine(): Promise<WatchdogRoutine> {
  const saved = await getItem<WatchdogRoutine>(TABLES.AGENT_ROUTINES, ARGUS_ROUTINE_ID);
  return saved ? { ...DEFAULT_ROUTINE, ...saved } : DEFAULT_ROUTINE;
}

async function loadHistory(): Promise<WatchdogCheck[]> {
  const all = await scanAll<WatchdogCheck>(TABLES.AGENT_CHECKS);
  return all
    .filter((c) => c.agentId === ARGUS_ROUTINE_ID)
    .sort((a, b) => (a.ranAt < b.ranAt ? 1 : -1))
    .slice(0, HISTORY_LIMIT);
}

export async function GET() {
  try {
    const [routine, history] = await Promise.all([loadRoutine(), loadHistory()]);
    return NextResponse.json({ routine, history, now: nowInSaoPaulo() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const body: { sendEmail?: boolean } = await req.json().catch(() => ({}));
    const routine = await loadRoutine();

    const results = await runProbes(routine);
    const overallOk = results.every((r) => r.ok);

    // Em execução manual o padrão é mandar e-mail (é o teste ponta a ponta que a
    // equipe usa); a UI pode desligar passando sendEmail:false.
    const wantsEmail = body.sendEmail !== false;
    let emailSent = false;
    let emailError: string | undefined;
    if (wantsEmail) {
      const mail = buildEmail(results, "manual");
      try {
        await sendEmail({ from: routine.sender, to: routine.recipients, subject: mail.subject, text: mail.text, html: mail.html });
        emailSent = true;
      } catch (e) {
        emailError = (e as Error).message;
      }
    }

    const ranAt = new Date().toISOString();
    const check: WatchdogCheck = {
      id: `${ARGUS_ROUTINE_ID}#manual-${ranAt}`,
      agentId: ARGUS_ROUTINE_ID,
      ranAt,
      trigger: "manual",
      overallOk,
      results,
      emailSent,
      emailError,
      recipients: routine.recipients,
      expiresAt: Math.floor(Date.now() / 1000) + 90 * 24 * 3600,
    };
    await putItem(TABLES.AGENT_CHECKS, check);

    return NextResponse.json({ ok: true, check, durationMs: Date.now() - startedAt });
  } catch (e) {
    console.error("Argus Watchtower error:", e);
    return NextResponse.json({ error: (e as Error).message || "Erro na verificação", durationMs: Date.now() - startedAt }, { status: 500 });
  }
}

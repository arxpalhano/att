/**
 * Lambda: site-watchdog  (agente "Argus Watchtower")
 *
 * Disparo: EventBridge → "cron(0 * * * ? *)" — DE HORA EM HORA.
 *
 * A Lambda não tem horário fixo embutido: a cada hora ela lê a rotina em
 * DynamoDB (`att-agent-routines`, item `argus-watchtower`) e só age se a hora
 * atual em America/Sao_Paulo estiver na lista `hours` (padrão: 13h e 21h).
 * É isso que torna os horários editáveis pelo portal sem redeploy nem IAM.
 *
 * O que faz quando o horário bate:
 *   1. Grava um "lock" idempotente do slot (att-agent-checks) — evita e-mail duplicado
 *   2. Testa cada URL da rotina (com retry, pra não alarmar por blip de rede)
 *   3. Manda e-mail via SES pros destinatários (sempre, ou só em falha)
 *   4. Grava o resultado no histórico que o portal exibe
 *
 * Roda independente do portal de propósito: se o app.archtechtour.com cair,
 * o monitoramento continua.
 *
 * ⚠️ A lógica de probe/e-mail é espelho de `src/lib/watchdog.ts` — ao mexer lá,
 * replique aqui (Lambda é standalone, não compartilha bundle com o Next.js).
 *
 * Env vars: TABLE_ROUTINES, TABLE_CHECKS, APP_AWS_REGION (default us-east-1)
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const REGION = process.env.APP_AWS_REGION || "us-east-1";
const TABLE_ROUTINES = process.env.TABLE_ROUTINES || "att-agent-routines";
const TABLE_CHECKS = process.env.TABLE_CHECKS || "att-agent-checks";
const ROUTINE_ID = "argus-watchtower";
const TZ = "America/Sao_Paulo";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const ses = new SESv2Client({ region: REGION });

interface Target { id: string; label: string; url: string; mustContain?: string; enabled: boolean }
interface Routine {
  id: string; enabled: boolean; hours: number[]; recipients: string[]; sender: string;
  targets: Target[]; notifyWhen: "always" | "only_failure"; timeoutMs: number; retries: number;
}
interface TargetResult {
  id: string; label: string; url: string; ok: boolean; httpStatus: number;
  finalUrl?: string; durationMs: number; attempts: number; error?: string;
}

const DEFAULT_ROUTINE: Routine = {
  id: ROUTINE_ID,
  enabled: true,
  hours: [13, 21],
  recipients: ["info@archtechtour.com", "palhano@arx.hk"],
  sender: "ArchTechTour Monitor <monitor@archtechtour.com>",
  targets: [{ id: "site", label: "Site institucional", url: "https://archtechtour.com", enabled: true }],
  notifyWhen: "always",
  timeoutMs: 15000,
  retries: 2,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nowInSaoPaulo(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: parseInt(get("hour"), 10) % 24, label };
}

async function probeTarget(target: Target, timeoutMs: number, retries: number): Promise<TargetResult> {
  const startedAt = Date.now();
  let attempts = 0;
  let last: { status: number; error?: string; finalUrl?: string } = { status: 0 };

  while (attempts <= retries) {
    attempts++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(target.url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "ATT-Argus-Watchtower/1.0 (+https://app.archtechtour.com)" },
      });
      const body = target.mustContain ? await res.text() : "";
      const statusOk = res.status >= 200 && res.status < 400;
      const contentOk = target.mustContain ? body.includes(target.mustContain) : true;
      if (statusOk && contentOk) {
        return { id: target.id, label: target.label, url: target.url, ok: true, httpStatus: res.status, finalUrl: res.url, durationMs: Date.now() - startedAt, attempts };
      }
      last = { status: res.status, finalUrl: res.url, error: !statusOk ? `HTTP ${res.status}` : `conteúdo esperado ausente ("${target.mustContain}")` };
    } catch (e) {
      const err = e as Error;
      last = { status: 0, error: err.name === "AbortError" ? `timeout após ${timeoutMs}ms` : err.message };
    } finally {
      clearTimeout(timer);
    }
    if (attempts <= retries) await sleep(5000);
  }
  return { id: target.id, label: target.label, url: target.url, ok: false, httpStatus: last.status, finalUrl: last.finalUrl, durationMs: Date.now() - startedAt, attempts, error: last.error };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function buildEmail(results: TargetResult[], when = new Date()) {
  const { label } = nowInSaoPaulo(when);
  const down = results.filter((r) => !r.ok);
  const ok = down.length === 0;
  const subject = ok ? `[ATT] Site OK — ${label}` : `[ATT] ⚠️ FORA DO AR: ${down.map((d) => d.label).join(", ")} — ${label}`;

  const linha = (r: TargetResult) => r.ok
    ? `OK    ${r.label} — HTTP ${r.httpStatus} em ${r.durationMs}ms (${r.url})`
    : `FALHA ${r.label} — ${r.error || "erro desconhecido"} após ${r.attempts} tentativa(s) (${r.url})`;

  const text = [
    ok ? "Tudo funcionando." : "ATENÇÃO: falha detectada.",
    "",
    ...results.map(linha),
    "",
    `Horário: ${label} (Brasília) · verificação automática`,
    "Argus Watchtower · Portal ArchTechTour — https://app.archtechtour.com",
  ].join("\n");

  const rows = results.map((r) => `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:${r.ok ? "#047857" : "#b91c1c"}">${r.ok ? "OK" : "FALHA"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a">${escapeHtml(r.label)}<br><span style="color:#64748b;font-size:12px">${escapeHtml(r.url)}</span></td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px">${r.ok ? `HTTP ${r.httpStatus} · ${r.durationMs}ms` : escapeHtml(`${r.error || "erro"} · ${r.attempts} tentativa(s)`)}</td>
    </tr>`).join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a">
  <div style="border-radius:16px;padding:18px 20px;background:${ok ? "#ecfdf5" : "#fef2f2"};border:1px solid ${ok ? "#a7f3d0" : "#fecaca"}">
    <p style="margin:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b">Argus Watchtower</p>
    <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:${ok ? "#047857" : "#b91c1c"}">${ok ? "Site funcionando normalmente" : "Falha detectada"}</p>
    <p style="margin:6px 0 0;font-size:13px;color:#475569">${label} (horário de Brasília) · verificação automática</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:14px">${rows}</table>
  <p style="margin-top:20px;font-size:12px;color:#94a3b8">Enviado automaticamente pelo agente Argus Watchtower · Portal ArchTechTour<br>
  Para ajustar horários ou destinatários: <a href="https://app.archtechtour.com" style="color:#0ea5e9">app.archtechtour.com</a> → Agentes AI → Argus Watchtower</p>
</div>`;

  return { subject, text, html, ok };
}

export const handler = async (event: unknown) => {
  const forced = !!(event as { force?: boolean } | null)?.force;
  const saved = await doc.send(new GetCommand({ TableName: TABLE_ROUTINES, Key: { id: ROUTINE_ID } }));
  const routine: Routine = { ...DEFAULT_ROUTINE, ...(saved.Item as Routine | undefined) };

  const { date, hour, label } = nowInSaoPaulo();

  if (!routine.enabled && !forced) {
    console.log(`[argus] rotina desativada — nada a fazer (${label})`);
    return { skipped: "disabled" };
  }
  if (!routine.hours.includes(hour) && !forced) {
    console.log(`[argus] ${hour}h não está na rotina [${routine.hours.join(", ")}] — pulando`);
    return { skipped: "off-schedule", hour };
  }

  // Lock idempotente do slot: se a Lambda for disparada duas vezes na mesma
  // hora, só a primeira envia e-mail.
  const slotId = `${ROUTINE_ID}#${date}T${String(hour).padStart(2, "0")}`;
  const checkId = forced ? `${ROUTINE_ID}#forced-${new Date().toISOString()}` : slotId;
  const ranAt = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 3600;

  try {
    await doc.send(new PutCommand({
      TableName: TABLE_CHECKS,
      Item: { id: checkId, agentId: ROUTINE_ID, ranAt, trigger: "schedule", running: true, expiresAt },
      ConditionExpression: "attribute_not_exists(id)",
    }));
  } catch (e) {
    if ((e as { name?: string }).name === "ConditionalCheckFailedException") {
      console.log(`[argus] slot ${checkId} já processado — pulando`);
      return { skipped: "already-ran", slot: checkId };
    }
    throw e;
  }

  const targets = routine.targets.filter((t) => t.enabled && t.url);
  const results = await Promise.all(targets.map((t) => probeTarget(t, routine.timeoutMs, routine.retries)));
  const overallOk = results.every((r) => r.ok);

  let emailSent = false;
  let emailError: string | undefined;
  const shouldEmail = routine.notifyWhen === "always" || !overallOk;
  if (shouldEmail && routine.recipients.length > 0) {
    const mail = buildEmail(results);
    try {
      await ses.send(new SendEmailCommand({
        FromEmailAddress: routine.sender,
        Destination: { ToAddresses: routine.recipients },
        Content: { Simple: {
          Subject: { Data: mail.subject, Charset: "UTF-8" },
          Body: { Text: { Data: mail.text, Charset: "UTF-8" }, Html: { Data: mail.html, Charset: "UTF-8" } },
        } },
      }));
      emailSent = true;
    } catch (e) {
      emailError = (e as Error).message;
      console.error("[argus] falha ao enviar e-mail:", emailError);
    }
  }

  await doc.send(new PutCommand({
    TableName: TABLE_CHECKS,
    Item: {
      id: checkId, agentId: ROUTINE_ID, ranAt, trigger: "schedule",
      overallOk, results, emailSent, emailError, recipients: routine.recipients, expiresAt,
    },
  }));

  console.log(`[argus] ${label} — ${overallOk ? "OK" : "FALHA"} · e-mail ${emailSent ? "enviado" : shouldEmail ? "FALHOU" : "não necessário"}`);
  return { ok: true, overallOk, emailSent, emailError, results };
};

/**
 * Argus Watchtower — monitoramento de disponibilidade dos sites da ATT.
 *
 * Esta lib concentra os TIPOS e a LÓGICA DE PROBE usados por dois consumidores:
 *   1. `src/app/api/agents/argus-watchtower/*` (portal — execução manual e edição da rotina)
 *   2. `lambda/site-watchdog` (execução agendada, roda de hora em hora e decide
 *      sozinha se o horário atual bate com a rotina salva no DynamoDB)
 *
 * A Lambda é independente do portal de propósito: se o app.archtechtour.com cair,
 * o monitoramento continua rodando e avisando. Por isso `lambda/site-watchdog/index.ts`
 * repete a lógica de probe — ao mexer aqui, replique lá (o README da Lambda avisa).
 */

export const ARGUS_ROUTINE_ID = "argus-watchtower";
export const WATCHDOG_TZ = "America/Sao_Paulo";

export interface WatchdogTarget {
  id: string;
  label: string;
  url: string;
  /** Texto que precisa existir no HTML pra considerar o site "funcionando" (opcional). */
  mustContain?: string;
  enabled: boolean;
}

export interface WatchdogRoutine {
  id: string;
  enabled: boolean;
  /** Horas do dia (0-23) em America/Sao_Paulo em que a verificação roda. */
  hours: number[];
  recipients: string[];
  /** Remetente — precisa ser um endereço do domínio verificado no SES. */
  sender: string;
  targets: WatchdogTarget[];
  /** `always` = manda e-mail toda vez; `only_failure` = só quando algo cai. */
  notifyWhen: "always" | "only_failure";
  timeoutMs: number;
  /** Tentativas extras antes de declarar o site fora do ar (evita falso positivo). */
  retries: number;
  updatedAt: string;
  updatedBy?: string;
}

export interface TargetResult {
  id: string;
  label: string;
  url: string;
  ok: boolean;
  httpStatus: number;
  finalUrl?: string;
  durationMs: number;
  attempts: number;
  error?: string;
}

export interface WatchdogCheck {
  /** `argus-watchtower#2026-08-24T13` (agendado) ou `argus-watchtower#manual-<iso>`. */
  id: string;
  agentId: string;
  ranAt: string;
  trigger: "schedule" | "manual";
  overallOk: boolean;
  results: TargetResult[];
  emailSent: boolean;
  emailError?: string;
  recipients: string[];
  /** TTL do DynamoDB (epoch em segundos) — histórico expira em 90 dias. */
  expiresAt: number;
}

export const DEFAULT_ROUTINE: WatchdogRoutine = {
  id: ARGUS_ROUTINE_ID,
  enabled: true,
  hours: [13, 21],
  recipients: ["info@archtechtour.com", "palhano@arx.hk"],
  sender: "ArchTechTour Monitor <monitor@archtechtour.com>",
  targets: [
    { id: "site", label: "Site institucional", url: "https://archtechtour.com", enabled: true },
  ],
  notifyWhen: "always",
  timeoutMs: 15000,
  retries: 2,
  updatedAt: new Date(0).toISOString(),
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hora atual (0-23) e data YYYY-MM-DD no fuso de São Paulo. */
export function nowInSaoPaulo(d = new Date()): { date: string; hour: number; label: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WATCHDOG_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const hour = parseInt(get("hour"), 10) % 24;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: WATCHDOG_TZ, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
  return { date, hour, label };
}

/** Testa uma URL com retry. `ok` = HTTP 2xx/3xx e (se configurado) texto presente. */
export async function probeTarget(target: WatchdogTarget, timeoutMs: number, retries: number): Promise<TargetResult> {
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
        cache: "no-store",
      });
      const body = target.mustContain ? await res.text() : "";
      const statusOk = res.status >= 200 && res.status < 400;
      const contentOk = target.mustContain ? body.includes(target.mustContain) : true;
      if (statusOk && contentOk) {
        return { id: target.id, label: target.label, url: target.url, ok: true, httpStatus: res.status, finalUrl: res.url, durationMs: Date.now() - startedAt, attempts };
      }
      last = {
        status: res.status,
        finalUrl: res.url,
        error: !statusOk ? `HTTP ${res.status}` : `conteúdo esperado ausente ("${target.mustContain}")`,
      };
    } catch (e) {
      const msg = (e as Error).name === "AbortError" ? `timeout após ${timeoutMs}ms` : (e as Error).message;
      last = { status: 0, error: msg };
    } finally {
      clearTimeout(timer);
    }
    if (attempts <= retries) await sleep(5000);
  }

  return {
    id: target.id, label: target.label, url: target.url, ok: false,
    httpStatus: last.status, finalUrl: last.finalUrl,
    durationMs: Date.now() - startedAt, attempts, error: last.error,
  };
}

export async function runProbes(routine: WatchdogRoutine): Promise<TargetResult[]> {
  const targets = routine.targets.filter((t) => t.enabled && t.url);
  return Promise.all(targets.map((t) => probeTarget(t, routine.timeoutMs, routine.retries)));
}

/** Monta assunto + corpo (texto e HTML) do e-mail. Só usa dados reais do probe. */
export function buildEmail(results: TargetResult[], trigger: "schedule" | "manual", when = new Date()) {
  const { label } = nowInSaoPaulo(when);
  const down = results.filter((r) => !r.ok);
  const ok = down.length === 0;
  const origem = trigger === "manual" ? "verificação manual" : "verificação automática";

  const subject = ok
    ? `[ATT] Site OK — ${label}`
    : `[ATT] ⚠️ FORA DO AR: ${down.map((d) => d.label).join(", ")} — ${label}`;

  const linha = (r: TargetResult) =>
    r.ok
      ? `OK    ${r.label} — HTTP ${r.httpStatus} em ${r.durationMs}ms (${r.url})`
      : `FALHA ${r.label} — ${r.error || "erro desconhecido"} após ${r.attempts} tentativa(s) (${r.url})`;

  const text = [
    ok ? "Tudo funcionando." : "ATENÇÃO: falha detectada.",
    "",
    ...results.map(linha),
    "",
    `Horário: ${label} (Brasília) · ${origem}`,
    "Argus Watchtower · Portal ArchTechTour — https://app.archtechtour.com",
  ].join("\n");

  const rows = results
    .map((r) => `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:${r.ok ? "#047857" : "#b91c1c"}">${r.ok ? "OK" : "FALHA"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a">${escapeHtml(r.label)}<br><span style="color:#64748b;font-size:12px">${escapeHtml(r.url)}</span></td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px">${r.ok ? `HTTP ${r.httpStatus} · ${r.durationMs}ms` : escapeHtml(`${r.error || "erro"} · ${r.attempts} tentativa(s)`)}</td>
    </tr>`)
    .join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a">
  <div style="border-radius:16px;padding:18px 20px;background:${ok ? "#ecfdf5" : "#fef2f2"};border:1px solid ${ok ? "#a7f3d0" : "#fecaca"}">
    <p style="margin:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b">Argus Watchtower</p>
    <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:${ok ? "#047857" : "#b91c1c"}">${ok ? "Site funcionando normalmente" : "Falha detectada"}</p>
    <p style="margin:6px 0 0;font-size:13px;color:#475569">${label} (horário de Brasília) · ${origem}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:14px">${rows}</table>
  <p style="margin-top:20px;font-size:12px;color:#94a3b8">Enviado automaticamente pelo agente Argus Watchtower · Portal ArchTechTour<br>
  Para ajustar horários ou destinatários: <a href="https://app.archtechtour.com" style="color:#0ea5e9">app.archtechtour.com</a> → Agentes AI → Argus Watchtower</p>
</div>`;

  return { subject, text, html, ok };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/** Normaliza/valida o que vem da UI antes de gravar no DynamoDB. */
export function sanitizeRoutine(input: Partial<WatchdogRoutine>, base: WatchdogRoutine): WatchdogRoutine {
  const hours = Array.from(new Set((input.hours ?? base.hours).map(Number).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))).sort((a, b) => a - b);
  const recipients = (input.recipients ?? base.recipients).map((r) => String(r).trim()).filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r));
  const targets = (input.targets ?? base.targets)
    .map((t, i) => ({
      id: String(t.id || `alvo-${i + 1}`),
      label: String(t.label || t.url || `Alvo ${i + 1}`).slice(0, 80),
      url: String(t.url || "").trim(),
      mustContain: t.mustContain ? String(t.mustContain).slice(0, 200) : undefined,
      enabled: t.enabled !== false,
    }))
    .filter((t) => /^https?:\/\//i.test(t.url));

  if (hours.length === 0) throw new Error("Defina ao menos um horário de verificação.");
  if (recipients.length === 0) throw new Error("Defina ao menos um destinatário válido.");
  if (targets.length === 0) throw new Error("Defina ao menos uma URL válida (http/https) para monitorar.");

  return {
    id: ARGUS_ROUTINE_ID,
    enabled: input.enabled ?? base.enabled,
    hours,
    recipients,
    sender: String(input.sender || base.sender).trim(),
    targets,
    notifyWhen: input.notifyWhen === "only_failure" ? "only_failure" : "always",
    timeoutMs: Math.min(Math.max(Number(input.timeoutMs ?? base.timeoutMs) || 15000, 3000), 30000),
    retries: Math.min(Math.max(Number(input.retries ?? base.retries) || 0, 0), 5),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ? String(input.updatedBy).slice(0, 120) : base.updatedBy,
  };
}

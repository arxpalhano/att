/**
 * Cliente HTTP do Asaas (somente servidor).
 *
 * Env vars (precisam estar em next.config.js `env` — Amplify SSR não injeta em runtime):
 *   ASAAS_API_KEY        chave de API (sandbox começa com $aact_hmlg_, produção com $aact_prod_)
 *   ASAAS_ENV            "sandbox" | "production" (padrão: deduz pela chave)
 *   ASAAS_WEBHOOK_TOKEN  token que o Asaas manda no header `asaas-access-token` (validado no webhook)
 *   FINANCE_SYNC_SECRET  segredo para o cron chamar POST /api/finance/sync sem usuário
 *
 * Limites do Asaas: 25.000 req/12h por conta, rate limit por endpoint (cabeçalhos
 * RateLimit-*), 429 quando passa. Por isso o portal NÃO consulta o Asaas ao abrir a
 * tela: lê o espelho no DynamoDB; o Asaas só é chamado no sync (paginado, 100 por
 * página) e quem avisa mudança é o webhook.
 */
import {
  FinCustomer, FinPayment, FinSubscription, FinInvoice, FinBillingType, FinPaymentStatus, finId,
} from "./finance";

export type AsaasEnv = "sandbox" | "production";

export function asaasEnv(): AsaasEnv {
  const forced = (process.env.ASAAS_ENV || "").toLowerCase();
  if (forced === "production" || forced === "prod") return "production";
  if (forced === "sandbox") return "sandbox";
  const key = process.env.ASAAS_API_KEY || "";
  return key.includes("_prod_") ? "production" : "sandbox";
}
export const asaasConfigured = () => !!process.env.ASAAS_API_KEY;
const baseUrl = () => (asaasEnv() === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");

export class AsaasError extends Error {
  constructor(message: string, public status: number, public body?: unknown) { super(message); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET/POST no Asaas com retry em 429 e 5xx (backoff curto). GET vai SEM body — com body o Asaas devolve 403. */
export async function asaasFetch<T>(path: string, opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; params?: Record<string, string | number | boolean | undefined>; body?: unknown } = {}): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new AsaasError("ASAAS_API_KEY não configurada", 500);
  const url = new URL(baseUrl() + path);
  Object.entries(opts.params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== "") url.searchParams.set(k, String(v)); });
  const method = opts.method ?? "GET";
  let lastErr: AsaasError | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url.toString(), {
      method,
      headers: { access_token: key, accept: "application/json", ...(opts.body !== undefined ? { "content-type": "application/json" } : {}), "user-agent": "ArchTechTour-Portal" },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    if (r.ok) return (await r.json()) as T;
    const text = await r.text().catch(() => "");
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* texto puro */ }
    const desc = (body as { errors?: Array<{ description?: string }> })?.errors?.map((e) => e.description).filter(Boolean).join("; ");
    lastErr = new AsaasError(`Asaas ${method} ${path} → HTTP ${r.status}${desc ? `: ${desc}` : ""}`, r.status, body);
    if (r.status === 429 || r.status >= 500) {
      const reset = Number(r.headers.get("RateLimit-Reset") || r.headers.get("Retry-After") || 0);
      await sleep(Math.min(15000, (reset > 0 ? reset * 1000 : 1500 * (attempt + 1))));
      continue;
    }
    throw lastErr;
  }
  throw lastErr ?? new AsaasError("Asaas: falha desconhecida", 500);
}

interface AsaasList<T> { object: "list"; hasMore: boolean; totalCount: number; limit: number; offset: number; data: T[] }

/** Pagina um endpoint de lista até o fim (limit 100). */
export async function asaasListAll<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}, max = 20000): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await asaasFetch<AsaasList<T>>(path, { params: { ...params, limit: 100, offset } });
    out.push(...(page.data ?? []));
    if (!page.hasMore || out.length >= max || (page.data ?? []).length === 0) break;
    offset += page.data.length;
  }
  return out;
}

/* ---------- formatos crus do Asaas (só o que usamos; ignorar campos desconhecidos) ---------- */

export interface AsaasCustomer {
  id: string; name: string; cpfCnpj?: string | null; email?: string | null; phone?: string | null; mobilePhone?: string | null;
  cityName?: string | null; state?: string | null; externalReference?: string | null; deleted?: boolean; dateCreated?: string;
}
export interface AsaasPayment {
  id: string; customer: string; subscription?: string | null; installment?: string | null;
  value: number; netValue?: number | null; originalValue?: number | null;
  billingType: FinBillingType; status: FinPaymentStatus;
  dueDate: string; originalDueDate?: string | null; paymentDate?: string | null; clientPaymentDate?: string | null;
  creditDate?: string | null; estimatedCreditDate?: string | null;
  description?: string | null; externalReference?: string | null;
  invoiceUrl?: string | null; bankSlipUrl?: string | null; transactionReceiptUrl?: string | null; invoiceNumber?: string | null;
  invoiceStatus?: string | null; deleted?: boolean; dateCreated?: string;
}
export interface AsaasSubscription {
  id: string; customer: string; value: number; cycle: string; billingType: FinBillingType;
  status: "ACTIVE" | "EXPIRED" | "INACTIVE"; nextDueDate?: string | null; endDate?: string | null;
  description?: string | null; externalReference?: string | null; deleted?: boolean; dateCreated?: string;
}
export interface AsaasInvoice {
  id: string; customer?: string | null; payment?: string | null; installment?: string | null; number?: string | null;
  status: string; statusDescription?: string | null; value: number; effectiveDate?: string | null;
  serviceDescription?: string | null; pdfUrl?: string | null; xmlUrl?: string | null; externalReference?: string | null;
}

const s = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function toFinCustomer(c: AsaasCustomer, now: string): FinCustomer {
  return {
    id: finId("customer", c.id), kind: "customer", asaasId: c.id, name: c.name || c.id,
    cpfCnpj: s(c.cpfCnpj), email: s(c.email), phone: s(c.mobilePhone) ?? s(c.phone),
    city: s(c.cityName), state: s(c.state), externalReference: s(c.externalReference),
    deleted: !!c.deleted, dateCreated: s(c.dateCreated), updatedAt: now,
  };
}
export function toFinPayment(p: AsaasPayment, now: string): FinPayment {
  return {
    id: finId("payment", p.id), kind: "payment", asaasId: p.id, customerId: p.customer,
    subscriptionId: s(p.subscription), installmentId: s(p.installment),
    value: n(p.value) ?? 0, netValue: n(p.netValue), originalValue: n(p.originalValue),
    billingType: p.billingType || "UNDEFINED", status: p.status,
    dueDate: p.dueDate, originalDueDate: s(p.originalDueDate), paymentDate: s(p.paymentDate), clientPaymentDate: s(p.clientPaymentDate),
    creditDate: s(p.creditDate), estimatedCreditDate: s(p.estimatedCreditDate),
    description: s(p.description), externalReference: s(p.externalReference),
    invoiceUrl: s(p.invoiceUrl), bankSlipUrl: s(p.bankSlipUrl), transactionReceiptUrl: s(p.transactionReceiptUrl),
    invoiceNumber: s(p.invoiceNumber), invoiceStatus: s(p.invoiceStatus),
    deleted: !!p.deleted, dateCreated: s(p.dateCreated), updatedAt: now,
  };
}
export function toFinSubscription(x: AsaasSubscription, now: string): FinSubscription {
  return {
    id: finId("subscription", x.id), kind: "subscription", asaasId: x.id, customerId: x.customer,
    value: n(x.value) ?? 0, cycle: x.cycle || "MONTHLY", billingType: x.billingType || "UNDEFINED", status: x.status,
    nextDueDate: s(x.nextDueDate), endDate: s(x.endDate), description: s(x.description), externalReference: s(x.externalReference),
    deleted: !!x.deleted, dateCreated: s(x.dateCreated), updatedAt: now,
  };
}
export function toFinInvoice(i: AsaasInvoice, now: string): FinInvoice {
  return {
    id: finId("invoice", i.id), kind: "invoice", asaasId: i.id, customerId: s(i.customer), paymentId: s(i.payment), installmentId: s(i.installment),
    number: s(i.number), status: i.status, statusDescription: s(i.statusDescription), value: n(i.value) ?? 0,
    effectiveDate: s(i.effectiveDate), serviceDescription: s(i.serviceDescription), pdfUrl: s(i.pdfUrl), xmlUrl: s(i.xmlUrl),
    externalReference: s(i.externalReference), updatedAt: now,
  };
}

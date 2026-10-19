/**
 * Módulo Financeiro — lado do servidor: sincronização Asaas → att-finance e leitura do espelho.
 * Ver src/lib/finance.ts (tipos/regras) e src/lib/asaas.ts (HTTP).
 */
import { scanAll, getItem, putItem, deleteItem, replaceAll, TABLES } from "./dynamo";
import {
  asaasFetch, asaasListAll, asaasEnv, asaasConfigured,
  AsaasCustomer, AsaasPayment, AsaasSubscription, AsaasInvoice,
  toFinCustomer, toFinPayment, toFinSubscription, toFinInvoice,
} from "./asaas";
import { FinCustomer, FinPayment, FinSubscription, FinInvoice, FinMeta, FinRecord, FinanceData, normName } from "./finance";

const META_ID = "meta#sync";

export async function readMeta(): Promise<FinMeta | null> {
  return getItem<FinMeta>(TABLES.FINANCE, META_ID);
}
async function writeMeta(patch: Partial<FinMeta>): Promise<FinMeta> {
  const cur: FinMeta = (await readMeta()) ?? { id: "meta#sync", kind: "meta", env: asaasEnv(), updatedAt: "" };
  const next: FinMeta = { ...cur, ...patch, id: META_ID, kind: "meta", env: asaasEnv(), updatedAt: new Date().toISOString() };
  await putItem(TABLES.FINANCE, next);
  return next;
}

/** Lê o espelho inteiro (tudo que não é evento de webhook). */
export async function readFinance(): Promise<FinanceData> {
  let rows: FinRecord[] = [];
  try { rows = await scanAll<FinRecord>(TABLES.FINANCE); } catch (e) {
    // Tabela ainda não existe/sem permissão: a tela avisa, não quebra.
    throw new Error(`att-finance: ${(e as Error).message}`);
  }
  const data: FinanceData = { customers: [], payments: [], subscriptions: [], invoices: [], meta: null, configured: asaasConfigured() };
  for (const r of rows) {
    switch (r.kind) {
      case "customer": data.customers.push(r); break;
      case "payment": data.payments.push(r); break;
      case "subscription": data.subscriptions.push(r); break;
      case "invoice": data.invoices.push(r); break;
      case "meta": data.meta = r; break;
    }
  }
  data.customers.sort((a, b) => a.name.localeCompare(b.name));
  data.payments.sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""));
  data.invoices.sort((a, b) => (b.effectiveDate || "").localeCompare(a.effectiveDate || ""));
  return data;
}

/** Só o que este cliente do portal pode ver: os registros do(s) cliente(s) Asaas vinculado(s) a ele. */
export function filterForClient(data: FinanceData, clientId: string): FinanceData {
  const mine = data.customers.filter((c) => c.clientId === clientId);
  const ids = new Set(mine.map((c) => c.asaasId));
  return {
    configured: data.configured,
    meta: data.meta ? { ...data.meta, balance: undefined, lastSyncError: undefined } : null, // saldo da ATT não é do cliente
    customers: mine.map((c) => ({ ...c, cpfCnpj: c.cpfCnpj })),
    payments: data.payments.filter((p) => ids.has(p.customerId) && !p.deleted),
    subscriptions: data.subscriptions.filter((s) => ids.has(s.customerId) && !s.deleted),
    invoices: data.invoices.filter((i) => (i.customerId && ids.has(i.customerId))),
  };
}

interface PortalClient { id: string; name: string; contactEmail?: string; code?: string }

/**
 * Vínculo automático cliente Asaas → cliente do portal, quando ainda não há vínculo manual:
 *   1. externalReference do Asaas == id do cliente do portal (ex.: "c6") ou == code (alias)
 *   2. nome normalizado igual
 *   3. e-mail igual ao contactEmail
 * Vínculo manual (linkSource = "manual") nunca é sobrescrito.
 */
export function autoLink(c: FinCustomer, prev: FinCustomer | null, clients: PortalClient[]): FinCustomer {
  if (prev?.linkSource === "manual") return { ...c, clientId: prev.clientId, linkSource: "manual" };
  const ref = (c.externalReference || "").trim().toLowerCase();
  const byRef = ref && clients.find((p) => p.id.toLowerCase() === ref || (p.code || "").toLowerCase() === ref);
  // Nome: igual, ou a marca "cabe" na razão social do Asaas ("Riccó" em "MOVEIS RICCO LTDA",
  // "WJ Luminárias" em "Luminarias WJ" — todas as palavras da marca presentes). Marca com uma
  // palavra só precisa ter 4+ letras para não casar "Rosa" com qualquer coisa.
  const asaasTokens = new Set(normName(c.name).split(" ").filter(Boolean));
  const byName = !byRef && (clients.find((p) => normName(p.name) && normName(p.name) === normName(c.name))
    ?? clients.find((p) => { const t = normName(p.name).split(" ").filter(Boolean); return t.length > 0 && (t.length > 1 || t[0].length >= 4) && t.every((w) => asaasTokens.has(w)); }));
  const email = (c.email || "").trim().toLowerCase();
  const byEmail = !byRef && !byName && email && clients.find((p) => (p.contactEmail || "").trim().toLowerCase() === email);
  const hit = byRef || byName || byEmail;
  if (hit) return { ...c, clientId: hit.id, linkSource: "auto" };
  // Sem match: mantém o auto anterior (se havia) para não "desvincular" sozinho.
  return prev?.clientId ? { ...c, clientId: prev.clientId, linkSource: prev.linkSource ?? "auto" } : { ...c, clientId: undefined, linkSource: undefined };
}

export interface SyncResult { counts: { customers: number; payments: number; subscriptions: number; invoices: number }; removed: number; balance?: number; env: string; ms: number }

/**
 * Sincronização completa: pagina clientes, cobranças, assinaturas e notas do Asaas,
 * grava no espelho e apaga do espelho o que sumiu do Asaas. Idempotente.
 * `since` (YYYY-MM-DD) limita cobranças por dateCreated — não usado no full sync.
 */
export async function syncFromAsaas(by: string): Promise<SyncResult> {
  const t0 = Date.now();
  const now = new Date().toISOString();
  const [existing, clients] = await Promise.all([scanAll<FinRecord>(TABLES.FINANCE), scanAll<PortalClient>(TABLES.CLIENTS)]);
  const prevById = new Map(existing.map((r) => [r.id, r]));

  try {
    const [customers, payments, subscriptions, invoices, balance] = await Promise.all([
      asaasListAll<AsaasCustomer>("/customers"),
      asaasListAll<AsaasPayment>("/payments"),
      asaasListAll<AsaasSubscription>("/subscriptions"),
      asaasListAll<AsaasInvoice>("/invoices").catch(() => [] as AsaasInvoice[]), // conta sem NF habilitada → 4xx; segue sem notas
      asaasFetch<{ balance: number }>("/finance/balance").then((b) => b.balance).catch(() => undefined),
    ]);

    const rows: FinRecord[] = [
      ...customers.map((c) => autoLink(toFinCustomer(c, now), (prevById.get(`customer#${c.id}`) as FinCustomer) ?? null, clients)),
      ...payments.map((p) => toFinPayment(p, now)),
      ...subscriptions.map((s) => toFinSubscription(s, now)),
      ...invoices.map((i) => toFinInvoice(i, now)),
    ];
    await replaceAll(TABLES.FINANCE, rows);

    // O que estava no espelho e não veio mais do Asaas (apagado lá) sai daqui.
    const fresh = new Set(rows.map((r) => r.id));
    const stale = existing.filter((r) => (r.kind as string) !== "meta" && (r.kind as string) !== "event" && !fresh.has(r.id));
    for (const r of stale) await deleteItem(TABLES.FINANCE, r.id);

    const counts = { customers: customers.length, payments: payments.length, subscriptions: subscriptions.length, invoices: invoices.length };
    await writeMeta({ balance, lastSyncAt: now, lastSyncBy: by, lastSyncCounts: counts, lastSyncError: undefined });
    return { counts, removed: stale.length, balance, env: asaasEnv(), ms: Date.now() - t0 };
  } catch (e) {
    await writeMeta({ lastSyncError: `${now}: ${(e as Error).message}` }).catch(() => undefined);
    throw e;
  }
}

/** Aplica um evento de webhook no espelho. Devolve o que foi feito (para log). */
export async function applyWebhookEvent(evt: { id?: string; event?: string; payment?: AsaasPayment; subscription?: AsaasSubscription; invoice?: AsaasInvoice }): Promise<string> {
  const now = new Date().toISOString();
  const event = String(evt.event || "");
  // Idempotência: o Asaas entrega "pelo menos uma vez"; o id do evento é a chave.
  if (evt.id) {
    const seen = await getItem<{ id: string }>(TABLES.FINANCE, `event#${evt.id}`);
    if (seen) return "duplicado";
    await putItem(TABLES.FINANCE, { id: `event#${evt.id}`, kind: "event", event, at: now, expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400 });
  }
  let what = event;
  if (evt.payment?.id) {
    const row = toFinPayment(evt.payment, now);
    if (event === "PAYMENT_DELETED") row.deleted = true;
    if (event === "PAYMENT_RESTORED") row.deleted = false;
    await putItem(TABLES.FINANCE, row);
    what = `${event} ${row.asaasId}`;
    // Cliente que ainda não está no espelho (cobrança nova de cliente novo): busca só ele.
    const cust = await getItem<FinCustomer>(TABLES.FINANCE, `customer#${row.customerId}`);
    if (!cust) {
      try {
        const c = await asaasFetch<AsaasCustomer>(`/customers/${row.customerId}`);
        const clients = await scanAll<PortalClient>(TABLES.CLIENTS);
        await putItem(TABLES.FINANCE, autoLink(toFinCustomer(c, now), null, clients));
      } catch { /* o sync diário completa */ }
    }
  }
  if (evt.subscription?.id) {
    const row = toFinSubscription(evt.subscription, now);
    if (event === "SUBSCRIPTION_DELETED") row.deleted = true;
    await putItem(TABLES.FINANCE, row);
    what = `${event} ${row.asaasId}`;
  }
  if (evt.invoice?.id) {
    const row = toFinInvoice(evt.invoice, now);
    await putItem(TABLES.FINANCE, row);
    what = `${event} ${row.asaasId}`;
  }
  await writeMeta({ lastWebhookAt: now, lastWebhookEvent: what }).catch(() => undefined);
  return what;
}

/** Vínculo manual cliente Asaas ↔ cliente do portal (clientId vazio = desvincular). */
export async function linkCustomer(asaasId: string, clientId: string | null): Promise<FinCustomer> {
  const cur = await getItem<FinCustomer>(TABLES.FINANCE, `customer#${asaasId}`);
  if (!cur) throw new Error(`Cliente Asaas ${asaasId} não está no espelho — sincronize primeiro`);
  const next: FinCustomer = { ...cur, clientId: clientId || undefined, linkSource: "manual", updatedAt: new Date().toISOString() };
  await putItem(TABLES.FINANCE, next);
  return next;
}

export type { FinPayment, FinSubscription, FinInvoice };

/**
 * Módulo Financeiro — tipos e helpers compartilhados entre browser e servidor.
 *
 * O Asaas (asaas.com) é a fonte de verdade financeira da ATT: cobranças,
 * assinaturas, notas fiscais, saldo. O portal NÃO substitui o Asaas; ele
 * mantém um ESPELHO somente leitura na tabela `att-finance` (DynamoDB) e cruza
 * com o que o Asaas não sabe: cliente do portal, contratos, blocos.
 *
 * Como o espelho é alimentado (src/app/api/finance/*):
 *   - webhook  → Asaas chama POST /api/finance/webhook a cada evento (tempo real)
 *   - sync     → POST /api/finance/sync pagina tudo do Asaas (carga inicial +
 *                reconciliação diária pelo EventBridge). Cobre evento perdido.
 *
 * Uma tabela só (`att-finance`), com `id = "<kind>#<id do Asaas>"` e o campo
 * `kind`. Volume pequeno (centenas de cobranças) — um Scan devolve tudo.
 */

export type FinKind = "customer" | "payment" | "subscription" | "invoice" | "meta" | "event";

export type FinPaymentStatus =
  | "PENDING" | "RECEIVED" | "CONFIRMED" | "OVERDUE" | "REFUNDED" | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED" | "REFUND_IN_PROGRESS" | "CHARGEBACK_REQUESTED" | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL" | "DUNNING_REQUESTED" | "DUNNING_RECEIVED" | "AWAITING_RISK_ANALYSIS";

export type FinBillingType = "UNDEFINED" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD" | "TRANSFER" | "DEPOSIT" | "PIX";

export interface FinCustomer {
  id: string;            // "customer#cus_xxx"
  kind: "customer";
  asaasId: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  externalReference?: string;
  /** Cliente do portal (att-clients.id) — vínculo manual ou automático. */
  clientId?: string;
  /** Como o vínculo foi feito: "manual" (na tela) ou "auto" (externalReference/nome). */
  linkSource?: "manual" | "auto";
  deleted?: boolean;
  dateCreated?: string;
  updatedAt: string;
}

export interface FinPayment {
  id: string;            // "payment#pay_xxx"
  kind: "payment";
  asaasId: string;
  customerId: string;    // cus_xxx
  subscriptionId?: string;
  installmentId?: string;
  value: number;
  netValue?: number;
  originalValue?: number;
  billingType: FinBillingType;
  status: FinPaymentStatus;
  dueDate: string;
  originalDueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  creditDate?: string;
  estimatedCreditDate?: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  invoiceNumber?: string;
  /** Situação da nota fiscal vinculada (vem na cobrança). */
  invoiceStatus?: string;
  deleted?: boolean;
  dateCreated?: string;
  updatedAt: string;
}

export interface FinSubscription {
  id: string;            // "subscription#sub_xxx"
  kind: "subscription";
  asaasId: string;
  customerId: string;
  value: number;
  cycle: string;         // WEEKLY | BIWEEKLY | MONTHLY | BIMONTHLY | QUARTERLY | SEMIANNUALLY | YEARLY
  billingType: FinBillingType;
  status: "ACTIVE" | "EXPIRED" | "INACTIVE";
  nextDueDate?: string;
  endDate?: string;
  description?: string;
  externalReference?: string;
  deleted?: boolean;
  dateCreated?: string;
  updatedAt: string;
}

export interface FinInvoice {
  id: string;            // "invoice#inv_xxx"
  kind: "invoice";
  asaasId: string;
  customerId?: string;
  paymentId?: string;
  installmentId?: string;
  number?: string;
  status: string;        // SCHEDULED | AUTHORIZED | PROCESSING_CANCELLATION | CANCELED | CANCELLATION_DENIED | ERROR
  statusDescription?: string;
  value: number;
  effectiveDate?: string;
  serviceDescription?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  externalReference?: string;
  updatedAt: string;
}

export interface FinMeta {
  id: "meta#sync";
  kind: "meta";
  env: "sandbox" | "production";
  balance?: number;
  lastSyncAt?: string;
  lastSyncBy?: string;
  lastSyncCounts?: { customers: number; payments: number; subscriptions: number; invoices: number };
  lastSyncError?: string;
  lastWebhookAt?: string;
  lastWebhookEvent?: string;
  updatedAt: string;
}

export type FinRecord = FinCustomer | FinPayment | FinSubscription | FinInvoice | FinMeta;

/** Resposta de GET /api/finance (já filtrada pelo que o usuário pode ver). */
export interface FinanceData {
  customers: FinCustomer[];
  payments: FinPayment[];
  subscriptions: FinSubscription[];
  invoices: FinInvoice[];
  meta: FinMeta | null;
  configured: boolean;
}

export const finId = (kind: FinKind, asaasId: string) => `${kind}#${asaasId}`;

export const PAYMENT_STATUS_LABELS: Record<FinPaymentStatus, string> = {
  PENDING: "Aguardando pagamento",
  RECEIVED: "Recebida",
  CONFIRMED: "Confirmada",
  OVERDUE: "Vencida",
  REFUNDED: "Estornada",
  RECEIVED_IN_CASH: "Recebida em dinheiro",
  REFUND_REQUESTED: "Estorno solicitado",
  REFUND_IN_PROGRESS: "Estorno em andamento",
  CHARGEBACK_REQUESTED: "Chargeback solicitado",
  CHARGEBACK_DISPUTE: "Em disputa de chargeback",
  AWAITING_CHARGEBACK_REVERSAL: "Aguardando reversão de chargeback",
  DUNNING_REQUESTED: "Em negativação",
  DUNNING_RECEIVED: "Recuperada por negativação",
  AWAITING_RISK_ANALYSIS: "Em análise de risco",
};

export const PAYMENT_STATUS_COLORS: Record<FinPaymentStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RECEIVED_IN_CASH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DUNNING_RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "bg-rose-50 text-rose-700 border-rose-200",
  REFUNDED: "bg-slate-100 text-slate-600 border-slate-200",
  REFUND_REQUESTED: "bg-slate-100 text-slate-600 border-slate-200",
  REFUND_IN_PROGRESS: "bg-slate-100 text-slate-600 border-slate-200",
  CHARGEBACK_REQUESTED: "bg-rose-50 text-rose-700 border-rose-200",
  CHARGEBACK_DISPUTE: "bg-rose-50 text-rose-700 border-rose-200",
  AWAITING_CHARGEBACK_REVERSAL: "bg-rose-50 text-rose-700 border-rose-200",
  DUNNING_REQUESTED: "bg-rose-50 text-rose-700 border-rose-200",
  AWAITING_RISK_ANALYSIS: "bg-amber-50 text-amber-700 border-amber-200",
};

export const BILLING_TYPE_LABELS: Record<FinBillingType, string> = {
  UNDEFINED: "A definir", BOLETO: "Boleto", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito",
  TRANSFER: "Transferência", DEPOSIT: "Depósito", PIX: "Pix",
};

export const CYCLE_LABELS: Record<string, string> = {
  WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", MONTHLY: "Mensal", BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral", SEMIANNUALLY: "Semestral", YEARLY: "Anual",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = { ACTIVE: "Ativa", EXPIRED: "Expirada", INACTIVE: "Inativa" };

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada", AUTHORIZED: "Autorizada", PROCESSING_CANCELLATION: "Cancelamento em processamento",
  CANCELED: "Cancelada", CANCELLATION_DENIED: "Cancelamento negado", ERROR: "Erro",
};

/** Cobrança efetivamente paga (entrou dinheiro). */
export const isPaid = (p: Pick<FinPayment, "status">) =>
  p.status === "RECEIVED" || p.status === "CONFIRMED" || p.status === "RECEIVED_IN_CASH" || p.status === "DUNNING_RECEIVED";
/** Em aberto: ainda esperando o cliente pagar (vencida ou não). */
export const isOpen = (p: Pick<FinPayment, "status">) =>
  p.status === "PENDING" || p.status === "OVERDUE" || p.status === "AWAITING_RISK_ANALYSIS";
export const isOverdue = (p: Pick<FinPayment, "status">) => p.status === "OVERDUE";

/** Quantas vezes por ano a assinatura cobra — para calcular receita mensal recorrente. */
export const cyclePerYear: Record<string, number> = {
  WEEKLY: 52, BIWEEKLY: 26, MONTHLY: 12, BIMONTHLY: 6, QUARTERLY: 4, SEMIANNUALLY: 2, YEARLY: 1,
};
export const monthlyValueOf = (s: Pick<FinSubscription, "value" | "cycle">) => (s.value * (cyclePerYear[s.cycle] ?? 12)) / 12;

export const fmtBRL = (n: number | undefined | null) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
export const fmtDate = (d?: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
export const monthKey = (d?: string) => (d ? d.slice(0, 7) : "");

/** Normaliza nome para casar cliente do Asaas com marca do portal ("Estúdio Bola" ≈ "estudio bola"). */
export const normName = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(ltda|me|eireli|sa|s\.a\.|ltda\.)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

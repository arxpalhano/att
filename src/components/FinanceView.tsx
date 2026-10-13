"use client";
/**
 * Financeiro — espelho do Asaas dentro do portal (fase 1: somente leitura).
 *
 * Equipe interna: visão geral (recebido no mês, a receber, vencido, saldo, receita
 * recorrente), gráfico de 12 meses, cobranças com filtros, assinaturas, notas fiscais
 * e a aba "Clientes Asaas" onde se vincula cada cliente do Asaas a uma marca do
 * portal (é esse vínculo que faz o cliente enxergar as próprias cobranças).
 *
 * Cliente (role "client"): só as cobranças e notas dele, com 2ª via do boleto/Pix,
 * recibo e PDF da nota. O servidor já filtra (GET /api/finance) — aqui é só exibição.
 *
 * Nada aqui chama o Asaas direto: lê o espelho (att-finance) e o botão "Sincronizar"
 * dispara POST /api/finance/sync. Ver src/lib/finance.ts.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { RefreshCw, Wallet, TrendingUp, AlertTriangle, Clock, Repeat, FileText, ExternalLink, Link2, Download, Search } from "lucide-react";
import { actorHeaders, logActivity } from "@/lib/activity-client";
import {
  FinanceData, FinPayment, FinCustomer, FinPaymentStatus,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, BILLING_TYPE_LABELS, CYCLE_LABELS, SUBSCRIPTION_STATUS_LABELS, INVOICE_STATUS_LABELS,
  isPaid, isOpen, isOverdue, monthlyValueOf, fmtBRL, fmtDate, monthKey, normName,
} from "@/lib/finance";

interface PUser { id: string; name: string; role: string; clientId?: string }
interface PClient { id: string; name: string; code?: string; active?: boolean }
interface Props { user: PUser; clients: PClient[]; canEdit: boolean }

type Tab = "overview" | "payments" | "subscriptions" | "invoices" | "customers";

const card = "rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.45)]";
const selectCls = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";
const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = (k: string) => { const [y, m] = k.split("-"); return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1]}/${y.slice(2)}`; };
const daysLate = (due: string) => Math.max(0, Math.floor((Date.now() - new Date(`${due}T12:00:00-03:00`).getTime()) / 86400000));

const EMPTY: FinanceData = { customers: [], payments: [], subscriptions: [], invoices: [], meta: null, configured: false };

export default function FinanceView({ user, clients, canEdit }: Props) {
  const isClient = user.role === "client";
  const [data, setData] = useState<FinanceData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/finance?t=${Date.now()}`, { headers: actorHeaders() });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setData({ ...EMPTY, ...j });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const r = await fetch("/api/finance/sync", { method: "POST", headers: actorHeaders() });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const c = j.counts;
      setSyncMsg(`Sincronizado (${j.env}): ${c.customers} clientes, ${c.payments} cobranças, ${c.subscriptions} assinaturas, ${c.invoices} notas.`);
      await load();
    } catch (e) { setSyncMsg(`Falha: ${(e as Error).message}`); }
    finally { setSyncing(false); }
  };

  const link = async (asaasId: string, clientId: string) => {
    const r = await fetch("/api/finance/link", { method: "POST", headers: { "content-type": "application/json", ...actorHeaders() }, body: JSON.stringify({ asaasId, clientId: clientId || null }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { alert(j.error || "Falha ao vincular"); return; }
    setData((d) => ({ ...d, customers: d.customers.map((c) => (c.asaasId === asaasId ? j.customer : c)) }));
  };

  const custById = useMemo(() => new Map(data.customers.map((c) => [c.asaasId, c])), [data.customers]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const brandOf = (customerId?: string) => { const c = customerId ? custById.get(customerId) : undefined; return c?.clientId ? clientById.get(c.clientId)?.name : undefined; };
  const custName = (customerId?: string) => (customerId ? custById.get(customerId)?.name ?? customerId : "—");

  const live = useMemo(() => data.payments.filter((p) => !p.deleted), [data.payments]);
  const kpi = useMemo(() => {
    const m = thisMonth();
    const paidMonth = live.filter((p) => isPaid(p) && monthKey(p.paymentDate || p.clientPaymentDate || p.dueDate) === m);
    const open = live.filter((p) => isOpen(p) && !isOverdue(p));
    const overdue = live.filter(isOverdue);
    const mrr = data.subscriptions.filter((s) => s.status === "ACTIVE" && !s.deleted).reduce((a, s) => a + monthlyValueOf(s), 0);
    const sum = (l: FinPayment[]) => l.reduce((a, p) => a + p.value, 0);
    return { paidMonth: sum(paidMonth), paidMonthN: paidMonth.length, open: sum(open), openN: open.length, overdue: sum(overdue), overdueN: overdue.length, mrr, overdueClients: new Set(overdue.map((p) => p.customerId)).size };
  }, [live, data.subscriptions]);

  const series = useMemo(() => {
    const months: string[] = [];
    const d = new Date(); d.setDate(1);
    for (let i = 11; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); }
    const rows = months.map((k) => ({ k, mes: monthLabel(k), recebido: 0, vencido: 0, aberto: 0 }));
    const idx = new Map(rows.map((r, i) => [r.k, i]));
    live.forEach((p) => {
      if (isPaid(p)) { const i = idx.get(monthKey(p.paymentDate || p.clientPaymentDate || p.dueDate)); if (i !== undefined) rows[i].recebido += p.value; }
      else if (isOverdue(p)) { const i = idx.get(monthKey(p.dueDate)); if (i !== undefined) rows[i].vencido += p.value; }
      else if (isOpen(p)) { const i = idx.get(monthKey(p.dueDate)); if (i !== undefined) rows[i].aberto += p.value; }
    });
    return rows.map((r) => ({ ...r, recebido: Math.round(r.recebido), vencido: Math.round(r.vencido), aberto: Math.round(r.aberto) }));
  }, [live]);

  const tabs: Array<{ id: Tab; label: string; n?: number }> = isClient
    ? [{ id: "payments", label: "Cobranças", n: live.length }, { id: "invoices", label: "Notas fiscais", n: data.invoices.length }, { id: "subscriptions", label: "Assinaturas", n: data.subscriptions.length }]
    : [{ id: "overview", label: "Visão geral" }, { id: "payments", label: "Cobranças", n: live.length }, { id: "subscriptions", label: "Assinaturas", n: data.subscriptions.length }, { id: "invoices", label: "Notas fiscais", n: data.invoices.length }, { id: "customers", label: "Clientes Asaas", n: data.customers.length }];
  useEffect(() => { if (isClient && tab === "overview") setTab("payments"); }, [isClient, tab]);

  const meta = data.meta;
  const unlinked = data.customers.filter((c) => !c.clientId && !c.deleted).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Financeiro</h1>
          <p className="text-sm text-slate-500">
            {isClient ? "Suas cobranças, notas fiscais e assinaturas com a ArchTechTour." : "Espelho do Asaas: cobranças, assinaturas e notas fiscais."}
            {meta?.env === "sandbox" && <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">SANDBOX · dados de teste</span>}
          </p>
          {!isClient && meta && (
            <p className="mt-1 text-xs text-slate-400">
              Última sincronização: {meta.lastSyncAt ? `${new Date(meta.lastSyncAt).toLocaleString("pt-BR")} (${meta.lastSyncBy})` : "nunca"}
              {meta.lastWebhookAt && <> · Último webhook: {new Date(meta.lastWebhookAt).toLocaleString("pt-BR")} ({meta.lastWebhookEvent})</>}
              {meta.lastSyncError && <span className="ml-2 text-rose-600">Erro no último sync: {meta.lastSyncError}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className={btnGhost} title="Recarregar"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Recarregar</button>
          {!isClient && canEdit && (
            <button onClick={sync} disabled={syncing || !data.configured} className={btnPrimary} title={data.configured ? "Buscar tudo do Asaas agora" : "ASAAS_API_KEY não configurada"}>
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Sincronizando…" : "Sincronizar com o Asaas"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível carregar o financeiro: {error}</div>}
      {syncMsg && <div className={`rounded-2xl border px-4 py-3 text-sm ${syncMsg.startsWith("Falha") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{syncMsg}</div>}
      {!isClient && !data.configured && !loading && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">A chave do Asaas (ASAAS_API_KEY) não está configurada neste ambiente. O espelho mostra o que já foi sincronizado, mas não atualiza.</div>}
      {!isClient && unlinked > 0 && !loading && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <span><Link2 className="mr-1.5 inline h-4 w-4" />{unlinked} cliente(s) do Asaas sem marca do portal vinculada. Sem o vínculo, o cliente não vê as próprias cobranças.</span>
          <button onClick={() => setTab("customers")} className={btnGhost}>Vincular</button>
        </div>
      )}
      {isClient && !loading && !error && data.customers.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Ainda não há dados financeiros vinculados à sua conta. Fale com a ArchTechTour pelo e-mail financeiro@archtechtour.com.</div>
      )}

      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {t.label}{typeof t.n === "number" && <span className="ml-1 opacity-60">{t.n}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && !isClient && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Kpi icon={TrendingUp} tone="emerald" label="Recebido no mês" value={fmtBRL(kpi.paidMonth)} sub={`${kpi.paidMonthN} cobrança(s)`} />
            <Kpi icon={Clock} tone="amber" label="A receber (no prazo)" value={fmtBRL(kpi.open)} sub={`${kpi.openN} cobrança(s)`} />
            <Kpi icon={AlertTriangle} tone="rose" label="Vencido" value={fmtBRL(kpi.overdue)} sub={`${kpi.overdueN} cobrança(s) · ${kpi.overdueClients} cliente(s)`} />
            <Kpi icon={Repeat} tone="sky" label="Receita recorrente / mês" value={fmtBRL(kpi.mrr)} sub={`${data.subscriptions.filter((s) => s.status === "ACTIVE" && !s.deleted).length} assinatura(s) ativa(s)`} />
            <Kpi icon={Wallet} tone="slate" label="Saldo no Asaas" value={fmtBRL(meta?.balance)} sub={meta?.lastSyncAt ? `em ${new Date(meta.lastSyncAt).toLocaleDateString("pt-BR")}` : "—"} />
          </div>
          <div className={card}>
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="text-sm font-semibold text-slate-800">Últimos 12 meses</h2><p className="text-xs text-slate-500">Recebido por mês de pagamento; aberto e vencido por mês de vencimento.</p></div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="recebido" name="Recebido" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="aberto" name="Em aberto" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="vencido" name="Vencido" stackId="a" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <OverdueByClient payments={live.filter(isOverdue)} custName={custName} brandOf={brandOf} />
        </>
      )}

      {tab === "payments" && <PaymentsTable payments={live} isClient={isClient} custName={custName} brandOf={brandOf} clients={clients} custById={custById} />}

      {tab === "subscriptions" && (
        <div className={card}>
          <Table
            cols={isClient ? ["Descrição", "Valor", "Ciclo", "Forma", "Próximo vencimento", "Situação"] : ["Cliente Asaas", "Marca", "Descrição", "Valor", "Ciclo", "Forma", "Próximo vencimento", "Situação"]}
            rows={data.subscriptions.filter((s) => !s.deleted).map((s) => [
              ...(isClient ? [] : [custName(s.customerId), brandOf(s.customerId) ?? <span className="text-slate-400">—</span>]),
              s.description || "—", fmtBRL(s.value), CYCLE_LABELS[s.cycle] ?? s.cycle, BILLING_TYPE_LABELS[s.billingType] ?? s.billingType, fmtDate(s.nextDueDate),
              <span key="st" className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{SUBSCRIPTION_STATUS_LABELS[s.status] ?? s.status}</span>,
            ])}
            empty="Nenhuma assinatura."
          />
        </div>
      )}

      {tab === "invoices" && (
        <div className={card}>
          <Table
            cols={isClient ? ["Nº", "Emissão", "Valor", "Serviço", "Situação", "Arquivos"] : ["Nº", "Cliente Asaas", "Marca", "Emissão", "Valor", "Serviço", "Situação", "Arquivos"]}
            rows={data.invoices.map((i) => [
              i.number || <span className="text-slate-400">—</span>,
              ...(isClient ? [] : [custName(i.customerId), brandOf(i.customerId) ?? <span className="text-slate-400">—</span>]),
              fmtDate(i.effectiveDate), fmtBRL(i.value), <span key="d" className="line-clamp-2 max-w-xs text-xs">{i.serviceDescription || "—"}</span>,
              <span key="st" className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${i.status === "AUTHORIZED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : i.status === "ERROR" || i.status === "CANCELED" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`} title={i.statusDescription}>{INVOICE_STATUS_LABELS[i.status] ?? i.status}</span>,
              <span key="f" className="flex gap-1">
                {i.pdfUrl && <a href={i.pdfUrl} target="_blank" rel="noreferrer" className={btnGhost}><Download className="h-3 w-3" /> PDF</a>}
                {i.xmlUrl && <a href={i.xmlUrl} target="_blank" rel="noreferrer" className={btnGhost}><Download className="h-3 w-3" /> XML</a>}
              </span>,
            ])}
            empty="Nenhuma nota fiscal no espelho. Se a emissão de NFS-e estiver habilitada no Asaas, elas aparecem após o sync."
          />
        </div>
      )}

      {tab === "customers" && !isClient && (
        <CustomersTab customers={data.customers} clients={clients} payments={live} canEdit={canEdit} onLink={link} />
      )}
    </div>
  );
}

/* ---------------- peças ---------------- */

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; tone: string; label: string; value: string; sub?: string }) {
  const tones: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600", sky: "bg-sky-50 text-sky-600", slate: "bg-slate-100 text-slate-600" };
  return (
    <div className={card}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="truncate text-lg font-bold text-slate-800">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function Table({ cols, rows, empty }: { cols: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-400">{cols.map((c) => <th key={c} className="px-2 py-2 font-semibold">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">{r.map((cell, j) => <td key={j} className="px-2 py-2 align-middle text-slate-700">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function StatusPill({ p }: { p: FinPayment }) {
  const late = isOverdue(p) ? daysLate(p.dueDate) : 0;
  return <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${PAYMENT_STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{PAYMENT_STATUS_LABELS[p.status] ?? p.status}{late > 0 && ` · ${late}d`}</span>;
}

function PaymentLinks({ p }: { p: FinPayment }) {
  return (
    <span className="flex flex-wrap gap-1">
      {isOpen(p) && p.invoiceUrl && <a href={p.invoiceUrl} target="_blank" rel="noreferrer" className={btnGhost} title="Pagar / 2ª via (Pix, boleto ou cartão)"><ExternalLink className="h-3 w-3" /> Pagar / 2ª via</a>}
      {isOpen(p) && p.bankSlipUrl && <a href={p.bankSlipUrl} target="_blank" rel="noreferrer" className={btnGhost}><Download className="h-3 w-3" /> Boleto</a>}
      {isPaid(p) && (p.transactionReceiptUrl || p.invoiceUrl) && <a href={p.transactionReceiptUrl || p.invoiceUrl} target="_blank" rel="noreferrer" className={btnGhost}><FileText className="h-3 w-3" /> Recibo</a>}
    </span>
  );
}

function PaymentsTable({ payments, isClient, custName, brandOf, clients, custById }: { payments: FinPayment[]; isClient: boolean; custName: (id?: string) => string; brandOf: (id?: string) => string | undefined; clients: PClient[]; custById: Map<string, FinCustomer> }) {
  const [status, setStatus] = useState<"all" | "open" | "overdue" | "paid" | "other">("all");
  const [brand, setBrand] = useState("all");
  const [period, setPeriod] = useState<"all" | "month" | "90" | "year">("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const m = thisMonth(); const y = m.slice(0, 4);
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const qq = normName(q);
    return payments.filter((p) => {
      if (status === "open" && !(isOpen(p) && !isOverdue(p))) return false;
      if (status === "overdue" && !isOverdue(p)) return false;
      if (status === "paid" && !isPaid(p)) return false;
      if (status === "other" && (isOpen(p) || isPaid(p))) return false;
      if (brand !== "all") { const c = custById.get(p.customerId); if (brand === "none" ? !!c?.clientId : c?.clientId !== brand) return false; }
      const ref = p.paymentDate || p.dueDate;
      if (period === "month" && monthKey(ref) !== m) return false;
      if (period === "year" && !ref.startsWith(y)) return false;
      if (period === "90" && ref < since90) return false;
      if (qq && !normName(`${custName(p.customerId)} ${p.description ?? ""} ${p.asaasId} ${p.invoiceNumber ?? ""}`).includes(qq)) return false;
      return true;
    });
  }, [payments, status, brand, period, q, custById, custName]);
  const total = rows.reduce((a, p) => a + p.value, 0);
  const exportCsv = () => {
    const head = ["id", "cliente_asaas", "marca", "descricao", "valor", "liquido", "forma", "vencimento", "pagamento", "status", "nota_fiscal"];
    const lines = rows.map((p) => [p.asaasId, custName(p.customerId), brandOf(p.customerId) ?? "", p.description ?? "", p.value.toFixed(2).replace(".", ","), (p.netValue ?? "").toString().replace(".", ","), BILLING_TYPE_LABELS[p.billingType] ?? p.billingType, p.dueDate, p.paymentDate ?? "", PAYMENT_STATUS_LABELS[p.status] ?? p.status, p.invoiceNumber ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `cobrancas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    logActivity({ type: "finance_export", entity: "finance", desc: `Exportou ${rows.length} cobrança(s) em CSV` });
  };
  return (
    <div className={card}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls}>
          <option value="all">Todas as situações</option><option value="open">Em aberto (no prazo)</option><option value="overdue">Vencidas</option><option value="paid">Pagas</option><option value="other">Estornos / outros</option>
        </select>
        {!isClient && (
          <select value={brand} onChange={(e) => setBrand(e.target.value)} className={selectCls}>
            <option value="all">Todas as marcas</option><option value="none">Sem marca vinculada</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className={selectCls}>
          <option value="all">Todo o período</option><option value="month">Este mês</option><option value="90">Últimos 90 dias</option><option value="year">Este ano</option>
        </select>
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className={`${selectCls} pl-8`} /></div>
        <span className="ml-auto text-xs text-slate-500">{rows.length} cobrança(s) · {fmtBRL(total)}</span>
        {!isClient && <button onClick={exportCsv} className={btnGhost} disabled={!rows.length}><Download className="h-3 w-3" /> CSV</button>}
      </div>
      <Table
        cols={isClient ? ["Descrição", "Valor", "Forma", "Vencimento", "Pagamento", "Situação", "Nota fiscal", ""] : ["Cliente Asaas", "Marca", "Descrição", "Valor", "Líquido", "Forma", "Vencimento", "Pagamento", "Situação", "NF", ""]}
        rows={rows.map((p) => [
          ...(isClient ? [] : [custName(p.customerId), brandOf(p.customerId) ?? <span className="text-slate-400">—</span>]),
          <span key="d" className="line-clamp-2 max-w-xs text-xs">{p.description || p.asaasId}</span>,
          <span key="v" className="whitespace-nowrap font-medium">{fmtBRL(p.value)}</span>,
          ...(isClient ? [] : [<span key="n" className="whitespace-nowrap text-xs text-slate-500">{fmtBRL(p.netValue)}</span>]),
          BILLING_TYPE_LABELS[p.billingType] ?? p.billingType, fmtDate(p.dueDate), fmtDate(p.paymentDate || p.clientPaymentDate),
          <StatusPill key="s" p={p} />,
          p.invoiceNumber ? <span className="text-xs">{p.invoiceNumber}</span> : p.invoiceStatus ? <span className="text-xs text-slate-400">{INVOICE_STATUS_LABELS[p.invoiceStatus] ?? p.invoiceStatus}</span> : <span className="text-slate-300">—</span>,
          <PaymentLinks key="l" p={p} />,
        ])}
        empty="Nenhuma cobrança com esses filtros."
      />
    </div>
  );
}

function OverdueByClient({ payments, custName, brandOf }: { payments: FinPayment[]; custName: (id?: string) => string; brandOf: (id?: string) => string | undefined }) {
  const rows = useMemo(() => {
    const m = new Map<string, { n: number; total: number; oldest: string }>();
    payments.forEach((p) => { const r = m.get(p.customerId) ?? { n: 0, total: 0, oldest: p.dueDate }; r.n++; r.total += p.value; if (p.dueDate < r.oldest) r.oldest = p.dueDate; m.set(p.customerId, r); });
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [payments]);
  return (
    <div className={card}>
      <h2 className="mb-2 text-sm font-semibold text-slate-800">Inadimplência por cliente</h2>
      <Table cols={["Cliente Asaas", "Marca", "Cobranças vencidas", "Total", "Mais antiga"]}
        rows={rows.map(([id, r]) => [custName(id), brandOf(id) ?? <span className="text-slate-400">—</span>, r.n, <span key="t" className="font-medium text-rose-700">{fmtBRL(r.total)}</span>, `${fmtDate(r.oldest)} (${daysLate(r.oldest)} dias)`])}
        empty="Nenhuma cobrança vencida. 🎉" />
    </div>
  );
}

function CustomersTab({ customers, clients, payments, canEdit, onLink }: { customers: FinCustomer[]; clients: PClient[]; payments: FinPayment[]; canEdit: boolean; onLink: (asaasId: string, clientId: string) => Promise<void> }) {
  const [q, setQ] = useState("");
  const stats = useMemo(() => {
    const m = new Map<string, { n: number; open: number; overdue: number }>();
    payments.forEach((p) => { const r = m.get(p.customerId) ?? { n: 0, open: 0, overdue: 0 }; r.n++; if (isOpen(p)) r.open += p.value; if (isOverdue(p)) r.overdue += p.value; m.set(p.customerId, r); });
    return m;
  }, [payments]);
  const suggest = (c: FinCustomer) => clients.find((p) => normName(p.name) && normName(p.name) === normName(c.name))?.id;
  const rows = customers.filter((c) => !c.deleted && (!q || normName(`${c.name} ${c.cpfCnpj ?? ""} ${c.email ?? ""}`).includes(normName(q))));
  return (
    <div className={card}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente Asaas…" className={`${selectCls} pl-8`} /></div>
        <p className="text-xs text-slate-500">O vínculo decide o que cada marca enxerga na tela Financeiro dela. Automático por referência externa, nome ou e-mail; manual aqui vence o automático.</p>
      </div>
      <Table cols={["Cliente Asaas", "CPF/CNPJ", "E-mail", "Cobranças", "Em aberto", "Vencido", "Marca no portal", ""]}
        rows={rows.map((c) => {
          const st = stats.get(c.asaasId); const sug = !c.clientId ? suggest(c) : undefined;
          return [
            <span key="n" className="font-medium">{c.name}</span>, <span key="d" className="text-xs">{c.cpfCnpj || "—"}</span>, <span key="e" className="text-xs">{c.email || "—"}</span>,
            st?.n ?? 0, fmtBRL(st?.open ?? 0), <span key="o" className={st?.overdue ? "font-medium text-rose-700" : ""}>{fmtBRL(st?.overdue ?? 0)}</span>,
            canEdit ? (
              <select key="s" value={c.clientId ?? ""} onChange={(e) => onLink(c.asaasId, e.target.value)} className={`${selectCls} ${!c.clientId ? "border-amber-300" : ""}`}>
                <option value="">— sem vínculo —</option>
                {clients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active === false ? " (inativo)" : ""}</option>)}
              </select>
            ) : (c.clientId ? clients.find((p) => p.id === c.clientId)?.name ?? c.clientId : <span className="text-slate-400">—</span>),
            <span key="h" className="text-[11px] text-slate-400">{c.clientId ? (c.linkSource === "manual" ? "manual" : "automático") : sug && canEdit ? <button onClick={() => onLink(c.asaasId, sug)} className="text-sky-700 underline">sugerido: {clients.find((p) => p.id === sug)?.name}</button> : ""}</span>,
          ];
        })}
        empty="Nenhum cliente do Asaas no espelho. Clique em “Sincronizar com o Asaas”." />
    </div>
  );
}

export type { FinPaymentStatus };

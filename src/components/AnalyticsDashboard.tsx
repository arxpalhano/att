"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  BarChart3, Users, Activity, Download, Clock, RefreshCw, TrendingUp, AlertCircle,
  Calendar, ChevronDown, Check,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================
export interface AnalyticsData {
  _meta?: { is_sample?: boolean; note?: string };
  cliente: string;
  alias: string;
  periodo: { inicio: string; fim: string; label: string };
  gerado_em: string;
  kpis: {
    usuarios_unicos: number;
    sessoes_unicas: number;
    media_sessoes: number;
    total_downloads: number;
    tempo_medio_min: number;
    total_eventos: number;
  };
  engajamento_por_produto: Array<{
    produto: string;
    produto_display: string;
    tempo_medio_sessao_seg: number;
    tempo_total_h: number;
    total_eventos: number;
  }>;
  eventos_por_tipo: Array<{ rotulo: string; total: number }>;
  sessoes_por_dia: Array<{ data: string; sessoes: number }>;
  origem_acesso: Array<{ origem: string; total: number; percentual: number }>;
  principais_cidades: Array<{ cidade: string; sessoes: number }>;
}

// ============================================================
// HELPERS
// ============================================================
function formatSecondsToMinSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMinutesToMinSec(min: number): string {
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDatePT(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

const CHART_COLORS = ["#06b6d4", "#f59e0b", "#1e293b", "#10b981", "#8b5cf6"];

// ============================================================
// DATE RANGE PRESETS
// ============================================================
interface DateRange { inicio: string; fim: string; label: string }

function getPreset(key: string): DateRange {
  const hoje = new Date();
  const fim = toISODate(hoje);
  switch (key) {
    case "7d": {
      const i = new Date(hoje); i.setDate(i.getDate() - 6);
      return { inicio: toISODate(i), fim, label: "Últimos 7 dias" };
    }
    case "30d": {
      const i = new Date(hoje); i.setDate(i.getDate() - 29);
      return { inicio: toISODate(i), fim, label: "Últimos 30 dias" };
    }
    case "90d": {
      const i = new Date(hoje); i.setDate(i.getDate() - 89);
      return { inicio: toISODate(i), fim, label: "Últimos 90 dias" };
    }
    case "this_month": {
      const i = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { inicio: toISODate(i), fim, label: "Este mês" };
    }
    case "last_month": {
      const i = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const f = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { inicio: toISODate(i), fim: toISODate(f), label: "Mês anterior" };
    }
    default:
      return getPreset("30d");
  }
}

// ============================================================
// SMALL COMPONENTS
// ============================================================
function KPICard({
  label, value, icon: Icon, sub,
}: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 leading-4">{label}</p>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-slate-950">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <p className="text-[2rem] font-bold tracking-tight text-slate-900 leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden ${className}`}>
      <div className="border-b border-slate-200/80 bg-slate-950 px-6 py-3.5">
        <p className="text-sm font-bold text-white">{title}</p>
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-slate-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-slate-600">{p.value.toLocaleString("pt-BR")}</p>
      ))}
    </div>
  );
}

// ============================================================
// DATE RANGE PICKER
// ============================================================
function DateRangePicker({
  range, onChange, disabled,
}: { range: DateRange; onChange: (r: DateRange) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customInicio, setCustomInicio] = useState(range.inicio);
  const [customFim, setCustomFim] = useState(range.fim);

  const presets = [
    { key: "7d", label: "Últimos 7 dias" },
    { key: "30d", label: "Últimos 30 dias" },
    { key: "90d", label: "Últimos 90 dias" },
    { key: "this_month", label: "Este mês" },
    { key: "last_month", label: "Mês anterior" },
  ];

  const aplicarCustom = () => {
    if (customInicio && customFim && customInicio <= customFim) {
      onChange({ inicio: customInicio, fim: customFim, label: "Personalizado" });
      setOpen(false);
      setCustomMode(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2 shadow-sm hover:border-slate-300 disabled:opacity-50 transition"
      >
        <Calendar className="h-3.5 w-3.5 text-slate-500" />
        <div className="text-left">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none">Período</span>
          <span className="block text-xs font-semibold text-slate-800 mt-0.5">{range.label}</span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setCustomMode(false); }} />
          <div className="absolute right-0 top-full mt-2 z-40 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            {!customMode ? (
              <div className="py-2">
                {presets.map((p) => {
                  const isActive = range.label === p.label;
                  return (
                    <button
                      key={p.key}
                      onClick={() => { onChange(getPreset(p.key)); setOpen(false); }}
                      className={`flex items-center justify-between w-full px-5 py-2.5 text-sm hover:bg-slate-50 transition ${isActive ? "text-cyan-700 font-semibold" : "text-slate-700"}`}
                    >
                      {p.label}
                      {isActive && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => setCustomMode(true)}
                    className="flex items-center justify-between w-full px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    Personalizado
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-slate-400" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Range personalizado</p>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Início</label>
                  <input type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/30" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fim</label>
                  <input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/30" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setCustomMode(false)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                  <button onClick={aplicarCustom} disabled={!customInicio || !customFim || customInicio > customFim}
                    className="flex-1 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-30">Aplicar</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function AnalyticsDashboard({
  clientAlias, clientName, canRefresh = false,
}: {
  clientAlias: string;
  clientName: string;
  canRefresh?: boolean;
}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("todos");
  const [range, setRange] = useState<DateRange>(() => getPreset("30d"));

  useEffect(() => {
    if (!clientAlias) return;
    setLoading(true);
    setError("");
    setData(null);
    setSelectedProduct("todos");
    fetch(`/api/analytics/${clientAlias}`)
      .then((r) => {
        if (!r.ok) throw new Error("Sem dados gerados ainda");
        return r.json();
      })
      .then((d: AnalyticsData) => {
        setData(d);
        if (d.periodo) {
          setRange({ inicio: d.periodo.inicio, fim: d.periodo.fim, label: d.periodo.label || "Salvo" });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientAlias]);

  const handleRefresh = useCallback(async (newRange?: DateRange) => {
    const r = newRange || range;
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch(`/api/analytics/${clientAlias}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio: r.inicio, fim: r.fim }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const fresh = await res.json();
      setData(fresh);
      if (newRange) setRange(newRange);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [clientAlias, range]);

  const handleRangeChange = useCallback((r: DateRange) => {
    setRange(r);
    handleRefresh(r);
  }, [handleRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Carregando analytics…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <BarChart3 className="h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">Dashboard ainda não gerado</p>
        <p className="text-xs text-slate-400 text-center max-w-xs">
          {error || "Clique em \"Gerar dashboard\" pra rodar as queries Athena pela primeira vez."}
        </p>
        {canRefresh && (
          <button
            onClick={() => handleRefresh()}
            disabled={refreshing}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {refreshing ? (<><RefreshCw className="h-4 w-4 animate-spin" /> Gerando…</>) : (<>Gerar dashboard ({range.label})</>)}
          </button>
        )}
      </div>
    );
  }

  const { kpis, engajamento_por_produto, eventos_por_tipo, sessoes_por_dia, origem_acesso, principais_cidades } = data;

  const productOptions = [
    { value: "todos", label: "Todos" },
    ...engajamento_por_produto.map((p) => ({ value: p.produto, label: p.produto_display })),
  ];

  const filteredEngajamento = selectedProduct === "todos"
    ? engajamento_por_produto
    : engajamento_por_produto.filter((p) => p.produto === selectedProduct);

  return (
    <div className="space-y-5">
      {data._meta?.is_sample && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-5 py-4">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Dados de exemplo</p>
            <p className="text-xs text-amber-700 mt-0.5">Clique em &quot;Atualizar&quot; para puxar dados reais do Athena.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-5 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Analytics</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{data.cliente}</h2>
          <p className="mt-1 text-sm text-slate-500">{formatDatePT(data.periodo.inicio)} — {formatDatePT(data.periodo.fim)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Produto</span>
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer max-w-[160px]">
              {productOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>

          <DateRangePicker range={range} onChange={handleRangeChange} disabled={refreshing} />

          {canRefresh && (
            <button onClick={() => handleRefresh()} disabled={refreshing}
              className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
              title="Re-rodar queries Athena pro período selecionado">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Atualizando…" : "Atualizar"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <KPICard label="Usuários Únicos" value={kpis.usuarios_unicos.toLocaleString("pt-BR")} icon={Users} />
        <KPICard label="Sessões Únicas" value={kpis.sessoes_unicas.toLocaleString("pt-BR")} icon={Activity} />
        <KPICard label="Média de Sessões" value={kpis.media_sessoes.toFixed(2).replace(".", ",")} icon={TrendingUp} />
        <KPICard label="Total de Downloads" value={kpis.total_downloads.toLocaleString("pt-BR")} icon={Download} />
        <KPICard label="Tempo Médio (min)" value={formatMinutesToMinSec(kpis.tempo_medio_min)} icon={Clock} />
        <KPICard label="Total de Eventos" value={kpis.total_eventos.toLocaleString("pt-BR")} icon={BarChart3} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.9fr_1fr]">
        <SectionCard title="Engajamento">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Produto</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Tempo Médio Sessão</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Tempo Total (h)</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Total Eventos</th>
                </tr>
              </thead>
              <tbody>
                {filteredEngajamento.map((p, i) => (
                  <tr key={p.produto} className={`border-b border-slate-100 transition-colors hover:bg-slate-50/60 ${i % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{p.produto_display}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-600">{formatSecondsToMinSec(p.tempo_medio_sessao_seg)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{p.tempo_total_h.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">{p.total_eventos.toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
                {filteredEngajamento.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">Nenhum dado para o produto selecionado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Eventos do Customizador">
          <div className="p-4" style={{ height: 236 }}>
            {eventos_por_tipo.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">Sem eventos no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventos_por_tipo} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                  <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v: string) => v.replace("botao_", "btn_").slice(0, 9)} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(6,182,212,0.07)" }} />
                  <Bar dataKey="total" fill="#06b6d4" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard title="Sessões Diárias">
          <div className="p-4" style={{ height: 210 }}>
            {sessoes_por_dia.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sessoes_por_dia} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                  <XAxis dataKey="data" tick={{ fontSize: 9, fill: "#94a3b8" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v + "T12:00:00");
                      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(" de ", " ");
                    }}
                    interval={Math.max(0, Math.ceil(sessoes_por_dia.length / 5) - 1)} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="sessoes" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#06b6d4" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Origem de Acessos">
          <div className="flex flex-col items-center p-4" style={{ height: 210 }}>
            {origem_acesso.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">Sem dados.</div>
            ) : (
              <>
                <div style={{ height: 130, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={origem_acesso} dataKey="total" nameKey="origem" cx="50%" cy="50%" outerRadius={55} innerRadius={28}>
                        {origem_acesso.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                      </Pie>
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as { origem: string; total: number; percentual: number };
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs max-w-[200px]">
                            <p className="font-semibold text-slate-700 truncate">{d.origem}</p>
                            <p className="text-slate-500">{d.total.toLocaleString("pt-BR")} • {d.percentual.toFixed(1)}%</p>
                          </div>
                        );
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-1.5 mt-1">
                  {origem_acesso.slice(0, 3).map((o, i) => (
                    <div key={o.origem} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i] }} />
                        <span className="truncate text-slate-500">{o.origem}</span>
                      </div>
                      <span className="flex-shrink-0 font-semibold text-slate-700">{o.percentual.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Principais Cidades">
          <div className="p-4" style={{ height: 210 }}>
            {principais_cidades.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">Sem dados de localização.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={principais_cidades} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="cidade" tick={{ fontSize: 10, fill: "#64748b" }} width={82}
                    tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + "…" : v} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(6,182,212,0.07)" }} />
                  <Bar dataKey="sessoes" fill="#1e293b" radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <p className="text-xs text-slate-400 text-right">
        Última atualização: {new Date(data.gerado_em).toLocaleString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

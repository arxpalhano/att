"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Plus, Database, CheckCircle, AlertCircle, X, Calendar,
} from "lucide-react";

interface DimClient {
  alias: string;
  cliente: string;
  has_data: boolean;
  last_updated: string | null;
  periodo: { inicio: string; fim: string } | null;
}

export default function AnalyticsClientsAdmin() {
  const [clients, setClients] = useState<DimClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshingAlias, setRefreshingAlias] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [newCliente, setNewCliente] = useState("");
  const [adding, setAdding] = useState(false);

  const loadClients = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/analytics/clients")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setClients(d.clients || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const refreshClient = async (alias: string) => {
    setRefreshingAlias(alias);
    setError("");
    try {
      const hoje = new Date();
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 29);
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const res = await fetch(`/api/analytics/${alias}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio: fmt(inicio), fim: fmt(hoje) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      loadClients(); // recarrega lista com last_updated novo
    } catch (e) {
      setError(`Refresh ${alias}: ${(e as Error).message}`);
    } finally {
      setRefreshingAlias(null);
    }
  };

  const addClient = async () => {
    if (!newAlias.trim() || !newCliente.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/analytics/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: newAlias.trim(), cliente: newCliente.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setNewAlias("");
      setNewCliente("");
      setShowAdd(false);
      loadClients();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Admin</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Gerenciar Analytics dos Clientes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Clientes registrados no <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">dim_client_alias</code> do Athena.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition shadow-sm"
        >
          <Plus className="h-4 w-4" /> Adicionar cliente
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-5 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !adding && setShowAdd(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Adicionar cliente</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              O alias é o prefixo dos produtos do cliente no customizador (ex: <code className="bg-slate-100 px-1 rounded">rsdesign</code> para produtos como <code className="bg-slate-100 px-1 rounded">rsdesign-arquibancada-aris</code>).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alias</label>
                <input type="text" value={newAlias} onChange={(e) => setNewAlias(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                  placeholder="ex: novocliente" maxLength={30}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-cyan-500/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do cliente</label>
                <input type="text" value={newCliente} onChange={(e) => setNewCliente(e.target.value)}
                  placeholder="ex: Novo Cliente Ltda"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/30" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} disabled={adding}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={addClient} disabled={adding || !newAlias || !newCliente}
                className="flex-1 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-30">
                {adding ? "Adicionando…" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-slate-200/80 bg-slate-950 px-6 py-3.5 flex items-center justify-between">
          <p className="text-sm font-bold text-white flex items-center gap-2"><Database className="h-4 w-4" />dim_client_alias ({clients.length})</p>
          <button onClick={loadClients} disabled={loading}
            className="text-xs text-slate-300 hover:text-white flex items-center gap-1">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Consultando Athena…</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cliente</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Alias</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Última atualização</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.alias} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{c.cliente}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{c.alias}</td>
                  <td className="px-5 py-3.5">
                    {c.has_data ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle className="h-3.5 w-3.5" /> Com dashboard
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                        <AlertCircle className="h-3.5 w-3.5" /> Sem dashboard
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">
                    {c.last_updated ? (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {new Date(c.last_updated).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        {c.periodo && (
                          <span className="ml-2 text-slate-400">({c.periodo.inicio} → {c.periodo.fim})</span>
                        )}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => refreshClient(c.alias)} disabled={refreshingAlias === c.alias}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition">
                      <RefreshCw className={`h-3 w-3 ${refreshingAlias === c.alias ? "animate-spin" : ""}`} />
                      {refreshingAlias === c.alias ? "Gerando…" : c.has_data ? "Atualizar" : "Gerar"}
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">Nenhum cliente cadastrado ainda.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate-400">
        💡 <strong>Atualização automática:</strong> A Lambda <code className="font-mono bg-slate-100 px-1 rounded">analytics-compute</code> roda todo dia 10 e atualiza todos esses clientes para o mês anterior. Esta página é só pra refresh manual e adicionar clientes novos.
      </p>
    </div>
  );
}

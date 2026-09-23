"use client";
/**
 * Desempenho da equipe — dashboard só do super admin.
 *
 * Lê o log de atividades do servidor (o que de fato foi gravado) e cruza com
 * blocos e tickets para responder: quanto cada pessoa entrega, em quanto tempo
 * cada etapa anda, quem está sobrecarregado ou atrasado, e quanto a equipe
 * consegue entregar por semana (capacidade para prometer aos clientes).
 *
 * Fontes: `status_changed` (bloco mudou de etapa — "Status: A → B"), `ticket_status`
 * (ticket → Entregue), demais tipos de trabalho (edições, uploads, aprovações).
 * Navegação (login/telas) não conta como trabalho.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { RefreshCw, TrendingUp, Clock, AlertTriangle, Users, Package, CheckCircle, Gauge } from "lucide-react";
import { ActivityRecord, BLOCK_STATUS_LABELS, isNavigation } from "@/lib/activity";

interface PUser { id: string; name: string; role: string; active?: boolean }
interface PBlock { id: string; clientId: string; title: string; status: string; owner?: string; materialsAt?: string; published?: string; dueDate?: string }
interface PTicket { id: string; blockId: string; clientId: string; status: string; slaDate: string; assignedTo?: string; archivedAt?: string }
interface PClient { id: string; name: string }

interface Props { users: PUser[]; blocks: PBlock[]; tickets: PTicket[]; clients: PClient[] }

const TEAM_ROLES = new Set(["admin", "internal_ops", "internal_modeling", "internal_programming"]);
/** O mapeamento de desempenho começa nesta segunda-feira; antes disso o log não representa o trabalho. */
const MAPPING_START = "2026-09-21";
const MAPPING_START_ISO = `${MAPPING_START}T00:00:00-03:00`;
const ROLE_PT: Record<string, string> = { admin: "Admin", internal_ops: "Operações", internal_modeling: "Modelagem", internal_programming: "Programação" };
const LABEL_TO_STATUS = Object.fromEntries(Object.entries(BLOCK_STATUS_LABELS).map(([k, v]) => [v, k]));
/** Etapas em que alguém está produzindo (o tempo nelas mede a equipe; o resto mede o cliente). */
const WORK_STAGES = ["in_modeling", "in_texturing", "in_programming", "internal_review", "sketchup_conversion", "bim_conversion"];
const CLIENT_STAGES = ["awaiting_client_files", "awaiting_client_material_validation", "awaiting_client_final_validation"];

const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const weekKey = (iso: string) => { const d = new Date(iso); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return dayKey(d.toISOString()).slice(5); };
const fmt1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1).replace(".", ",") : "—");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const parseStatus = (desc: string): { from: string; to: string } | null => {
  const m = /^Status: (.+?) → (.+?)(?: · |$)/.exec(desc);
  if (!m) return null;
  return { from: LABEL_TO_STATUS[m[1]] ?? m[1], to: LABEL_TO_STATUS[m[2]] ?? m[2] };
};

const card = "rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.45)]";

export default function TeamPerformance({ users, blocks, tickets, clients }: Props) {
  const [days, setDays] = useState(30);
  const [items, setItems] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [person, setPerson] = useState("all");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/activity?days=${days}&t=${Date.now()}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(j.items)) throw new Error(j.error || `HTTP ${r.status}`);
      setItems(j.items as ActivityRecord[]);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const team = useMemo(() => users.filter((u) => u.active !== false && TEAM_ROLES.has(u.role)), [users]);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id;
  // Nunca antes do início do mapeamento (21/09/2026).
  const since = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - days); const iso = d.toISOString(); return iso < new Date(MAPPING_START_ISO).toISOString() ? new Date(MAPPING_START_ISO).toISOString() : iso; }, [days]);
  const today = dayKey(new Date().toISOString());

  const work = useMemo(() => items.filter((a) => !isNavigation(a) && a.at >= since), [items, since]);

  // ---- ciclos: do dia em que o ticket caiu para a pessoa até o dia em que ela
  // mandou para a próxima etapa (ticket Entregue ou bloco mudou de status).
  type Cycle = { ticketId: string; label: string; userId: string; blockId: string; clientId?: string; start: string; end: string | null; days: number; onTime: boolean | null; slaDate: string; startNote?: string };
  const cycles = useMemo<Cycle[]>(() => {
    const userByName = new Map(users.map((u) => [u.name.toLowerCase(), u.id]));
    const byTicket = new Map<string, ActivityRecord[]>();
    items.forEach((a) => { if (a.entity === "tickets" && a.entityId) { const l = byTicket.get(a.entityId) ?? []; l.push(a); byTicket.set(a.entityId, l); } });
    const blockMoves = new Map<string, string[]>(); // blockId → datas de status_changed
    items.forEach((a) => { if (a.type === "status_changed" && a.blockId) { const l = blockMoves.get(a.blockId) ?? []; l.push(a.at); blockMoves.set(a.blockId, l); } });
    const out: Cycle[] = [];
    const now = new Date().toISOString();
    tickets.forEach((t) => {
      const ev = (byTicket.get(t.id) ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
      // atribuições (quem recebeu, quando)
      const assigns: Array<{ at: string; userId: string; note?: string }> = [];
      ev.forEach((a) => {
        let m = /atribuído a (.+)$/.exec(a.desc) || /Ticket criado: .*? · responsável (.+)$/.exec(a.desc);
        if (m) { const uid = userByName.get(m[1].trim().toLowerCase()); if (uid) assigns.push({ at: a.at, userId: uid }); }
      });
      const startIso = new Date(MAPPING_START_ISO).toISOString();
      // Ticket que já estava com alguém quando o mapeamento começou conta desde o início do mapeamento.
      if (t.assignedTo && !assigns.some((x) => x.at >= startIso) && (t.status !== "delivered" || ev.some((a) => a.type === "ticket_status" && / → Entregue$/.test(a.desc) && a.at >= startIso))) {
        assigns.unshift({ at: startIso, userId: t.assignedTo, note: "já estava com a pessoa no início do mapeamento" });
      }
      const label = ev[0]?.entityLabel ?? t.id;
      assigns.forEach((as, i) => {
        if (as.at < startIso) return;
        const nextAssign = assigns[i + 1]?.at ?? null;
        const delivered = ev.find((a) => a.type === "ticket_status" && / → Entregue$/.test(a.desc) && a.at > as.at && (!nextAssign || a.at <= nextAssign))?.at ?? null;
        const moved = (blockMoves.get(t.blockId) ?? []).filter((d) => d > as.at && (!nextAssign || d <= nextAssign)).sort()[0] ?? null;
        const end = [delivered, moved, nextAssign].filter(Boolean).sort()[0] ?? null;
        const endedByReassign = end !== null && end === nextAssign && end !== delivered && end !== moved;
        if (endedByReassign) return; // passou para outra pessoa sem concluir: não é ciclo dela
        const finish = end ?? now;
        const daysN = Math.max(0, (new Date(finish).getTime() - new Date(as.at).getTime()) / 86400000);
        out.push({ ticketId: t.id, label, userId: as.userId, blockId: t.blockId, clientId: t.clientId, start: as.at, end, days: Math.round(daysN * 10) / 10, onTime: end ? dayKey(end) <= t.slaDate : null, slaDate: t.slaDate, startNote: as.note });
      });
    });
    return out;
  }, [items, tickets, users]);

  // ---- por pessoa
  type Row = { id: string; name: string; role: string; actions: number; moves: number; delivered: number; onTime: number; published: number; activeDays: number; openLoad: number; late: number; last: string; done: number; avgDays: number; medDays: number; doneOnTime: number; openCycles: number; openAvgAge: number };
  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    team.forEach((u) => map.set(u.id, { id: u.id, name: u.name, role: u.role, actions: 0, moves: 0, delivered: 0, onTime: 0, published: 0, activeDays: 0, openLoad: 0, late: 0, last: "", done: 0, avgDays: NaN, medDays: NaN, doneOnTime: 0, openCycles: 0, openAvgAge: NaN }));
    const days_ = new Map<string, Set<string>>();
    const deliveredSeen = new Set<string>();
    work.forEach((a) => {
      const r = map.get(a.userId); if (!r) return;
      r.actions++;
      if (a.at > r.last) r.last = a.at;
      const ds = days_.get(a.userId) ?? new Set<string>(); ds.add(dayKey(a.at)); days_.set(a.userId, ds);
      if (a.type === "status_changed") {
        r.moves++;
        const p = parseStatus(a.desc);
        if (p?.to === "published") r.published++;
      }
      if (a.type === "ticket_status" && / → Entregue$/.test(a.desc) && a.entityId && !deliveredSeen.has(a.entityId)) {
        deliveredSeen.add(a.entityId);
        r.delivered++;
        const t = tickets.find((x) => x.id === a.entityId);
        if (t && dayKey(a.at) <= t.slaDate) r.onTime++;
      }
    });
    tickets.forEach((t) => {
      if (t.status === "delivered" || t.archivedAt || !t.assignedTo) return;
      const r = map.get(t.assignedTo); if (!r) return;
      r.openLoad++;
      if (t.slaDate < today) r.late++;
    });
    map.forEach((r) => {
      r.activeDays = days_.get(r.id)?.size ?? 0;
      const mine = cycles.filter((c) => c.userId === r.id && (c.end ? c.end >= since : true));
      const closed = mine.filter((c) => c.end).map((c) => c.days).sort((a, b) => a - b);
      const open = mine.filter((c) => !c.end);
      r.done = closed.length;
      r.avgDays = closed.length ? closed.reduce((a, b) => a + b, 0) / closed.length : NaN;
      r.medDays = closed.length ? closed[Math.floor((closed.length - 1) / 2)] : NaN;
      r.doneOnTime = mine.filter((c) => c.end && c.onTime).length;
      r.openCycles = open.length;
      r.openAvgAge = open.length ? open.reduce((a, c) => a + c.days, 0) / open.length : NaN;
    });
    return Array.from(map.values()).sort((a, b) => b.done - a.done || b.delivered - a.delivered || b.moves - a.moves);
  }, [work, team, tickets, today, cycles, since]);

  const visibleRows = person === "all" ? rows : rows.filter((r) => r.id === person);

  // ---- equipe
  const totals = useMemo(() => {
    const delivered = rows.reduce((n, r) => n + r.delivered, 0);
    const onTime = rows.reduce((n, r) => n + r.onTime, 0);
    const published = rows.reduce((n, r) => n + r.published, 0);
    const moves = rows.reduce((n, r) => n + r.moves, 0);
    const openLoad = tickets.filter((t) => t.status !== "delivered" && !t.archivedAt).length;
    const late = tickets.filter((t) => t.status !== "delivered" && !t.archivedAt && t.slaDate < today).length;
    const unassigned = tickets.filter((t) => t.status !== "delivered" && !t.archivedAt && !t.assignedTo).length;
    const weeks = Math.max(1, (Date.now() - new Date(since).getTime()) / (7 * 86400000));
    // Lead time materiais → publicado, nos blocos publicados no período
    const lt = blocks.filter((b) => b.materialsAt && b.published && b.published >= since.slice(0, 10)).map((b) => (new Date(`${b.published}T12:00:00`).getTime() - new Date(`${b.materialsAt}T12:00:00`).getTime()) / 86400000).filter((d) => d >= 0);
    const leadTime = lt.length ? lt.reduce((a, b) => a + b, 0) / lt.length : NaN;
    return { delivered, onTime, published, moves, openLoad, late, unassigned, perWeek: delivered / weeks, publishedPerWeek: published / weeks, leadTime, leadN: lt.length, active: rows.filter((r) => r.actions > 0).length };
  }, [rows, tickets, blocks, days, since, today]);

  // ---- semanas: entregas por pessoa
  const weekly = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    const seen = new Set<string>();
    work.forEach((a) => {
      const isDeliver = a.type === "ticket_status" && / → Entregue$/.test(a.desc) && a.entityId && !seen.has(a.entityId);
      const isPublish = a.type === "status_changed" && parseStatus(a.desc)?.to === "published";
      if (!isDeliver && !isPublish) return;
      if (isDeliver) seen.add(a.entityId!);
      const wk = weekKey(a.at);
      const row = map.get(wk) ?? { semana: wk };
      const who = nameOf(a.userId).split(" ")[0];
      row[who] = ((row[who] as number) || 0) + 1;
      map.set(wk, row);
    });
    return Array.from(map.values()).sort((a, b) => String(a.semana).localeCompare(String(b.semana)));
  }, [work]); // eslint-disable-line react-hooks/exhaustive-deps
  const weeklyPeople = useMemo(() => Array.from(new Set(weekly.flatMap((w) => Object.keys(w).filter((k) => k !== "semana")))), [weekly]);
  const PALETTE = ["#0891b2", "#059669", "#7c3aed", "#d97706", "#e11d48", "#2563eb", "#0f766e", "#9333ea"];

  // ---- tempo médio por etapa (entre dois status_changed do mesmo bloco)
  const stageTimes = useMemo(() => {
    const byBlock = new Map<string, ActivityRecord[]>();
    items.filter((a) => a.type === "status_changed" && a.blockId).forEach((a) => { const l = byBlock.get(a.blockId) ?? []; l.push(a); byBlock.set(a.blockId, l); });
    const acc = new Map<string, number[]>();
    byBlock.forEach((list) => {
      list.sort((a, b) => a.at.localeCompare(b.at));
      for (let i = 0; i < list.length - 1; i++) {
        const p = parseStatus(list[i].desc); if (!p) continue;
        if (list[i + 1].at < since) continue;
        const d = (new Date(list[i + 1].at).getTime() - new Date(list[i].at).getTime()) / 86400000;
        const l = acc.get(p.to) ?? []; l.push(d); acc.set(p.to, l);
      }
    });
    return [...WORK_STAGES, ...CLIENT_STAGES].map((st) => { const l = acc.get(st) ?? []; return { etapa: BLOCK_STATUS_LABELS[st] ?? st, dias: l.length ? Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10 : 0, n: l.length, cliente: CLIENT_STAGES.includes(st) }; }).filter((s) => s.n > 0);
  }, [items, since]);

  // ---- por cliente: o que saiu e o que está na fila
  const byClient = useMemo(() => {
    const m = new Map<string, { name: string; published: number; open: number; late: number }>();
    const add = (id: string) => { if (!m.has(id)) m.set(id, { name: clientName(id), published: 0, open: 0, late: 0 }); return m.get(id)!; };
    work.forEach((a) => { if (a.type === "status_changed" && a.clientId && parseStatus(a.desc)?.to === "published") add(a.clientId).published++; });
    tickets.forEach((t) => { if (t.status === "delivered" || t.archivedAt) return; const c = add(t.clientId); c.open++; if (t.slaDate < today) c.late++; });
    return Array.from(m.values()).filter((c) => c.published || c.open).sort((a, b) => b.published - a.published || b.open - a.open);
  }, [work, tickets, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCls = "text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
  const Kpi = ({ icon: Icon, label, value, hint, tone = "text-slate-900" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; hint?: string; tone?: string }) => (
    <div className={card}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p><p className={`mt-3 text-[1.75rem] font-semibold tracking-tight ${tone}`}>{value}</p>{hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}</div>
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><Icon className="h-4 w-4" /></span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Super admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.25rem]">Desempenho da equipe</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Quanto cada pessoa entrega, quanto tempo cada etapa leva e quanto a equipe consegue prometer. Tudo sai do log de atividades gravado pelo servidor — nada estimado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectCls}>
            <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={365}>Desde o início do mapeamento (21/09)</option>
          </select>
          <select value={person} onChange={(e) => setPerson(e.target.value)} className={selectCls}>
            <option value="all">Toda a equipe</option>
            {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar</button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Não foi possível ler o log de atividades: {error}</div>}
      <p className="text-xs text-amber-700">Mapeamento a partir de <b>segunda, 21/09/2026</b>. Nada anterior entra nas contas.</p>

      {(() => { const closed = cycles.filter((c) => c.end && c.end >= since); const avg = closed.length ? closed.reduce((a, c) => a + c.days, 0) / closed.length : NaN; const onTime = closed.filter((c) => c.onTime).length; const open = cycles.filter((c) => !c.end); return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi icon={Clock} label="Ciclo médio por etapa" value={Number.isFinite(avg) ? `${fmt1(avg)} d` : "—"} hint={`do dia em que o ticket caiu para a pessoa até ela mandar adiante · ${closed.length} etapa(s) concluída(s)`} />
        <Kpi icon={CheckCircle} label="Etapas concluídas no prazo" value={pct(onTime, closed.length)} hint={`${onTime} de ${closed.length} concluídas até o prazo do ticket`} />
        <Kpi icon={AlertTriangle} label="Etapas em andamento" value={open.length} tone={open.some((c) => c.days > 14) ? "text-rose-600" : "text-slate-900"} hint={open.length ? `há em média ${fmt1(open.reduce((a, c) => a + c.days, 0) / open.length)} dias com a pessoa · ${open.filter((c) => c.days > 14).length} há mais de 14 dias` : "nada em andamento"} />
      </div>); })()}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={CheckCircle} label="Tickets entregues" value={totals.delivered} hint={`${fmt1(totals.perWeek)} por semana · ${pct(totals.onTime, totals.delivered)} no prazo`} />
        <Kpi icon={Package} label="Blocos publicados" value={totals.published} hint={`${fmt1(totals.publishedPerWeek)} por semana`} />
        <Kpi icon={Clock} label="Materiais → publicado" value={Number.isFinite(totals.leadTime) ? `${fmt1(totals.leadTime)} d` : "—"} hint={totals.leadN ? `média em ${totals.leadN} bloco(s) publicado(s) no período` : "sem bloco com data de materiais publicado no período"} />
        <Kpi icon={AlertTriangle} label="Atrasados agora" value={totals.late} tone={totals.late ? "text-rose-600" : "text-slate-900"} hint={`${totals.openLoad} tickets em aberto · ${totals.unassigned} sem responsável`} />
      </div>

      <div className={card}>
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Capacidade</p><Gauge className="h-4 w-4 text-slate-400" /></div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          No ritmo dos últimos {days} dias a equipe entrega <b>{fmt1(totals.perWeek)} tickets por semana</b> e publica <b>{fmt1(totals.publishedPerWeek)} blocos por semana</b> — cerca de <b>{Math.round(totals.publishedPerWeek * 4.3)} blocos por mês</b>.
          {totals.openLoad > 0 && totals.perWeek > 0 && <> Com {totals.openLoad} tickets em aberto, a fila atual leva <b>{fmt1(totals.openLoad / totals.perWeek)} semanas</b> para esvaziar sem entrada nova.</>}
          {Number.isFinite(totals.leadTime) && <> Um bloco novo, com materiais completos, tem levado <b>{fmt1(totals.leadTime)} dias</b> até publicar.</>}
        </p>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Por pessoa</p><Users className="h-4 w-4 text-slate-400" /></div>
        <p className="mt-1 text-xs text-slate-500">Concluídas = etapas que a pessoa recebeu (ticket caiu para ela) e mandou adiante. Ciclo = dias entre receber e mandar adiante. Em andamento = tickets que estão com ela agora e há quantos dias. Etapas = mudanças de status de bloco feitas por ela.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>{["Pessoa", "Concluídas", "Ciclo médio", "Mediana", "No prazo", "Em andamento", "Há (média)", "Publicou", "Etapas", "Ações", "Dias ativos", "Atrasados", "Última atividade"].map((h) => <th key={h} className="border-b border-r border-slate-200 px-3 py-2.5 last:border-r-0 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => (
                <tr key={r.id} className={i % 2 ? "bg-slate-50/70" : "bg-white"}>
                  <td className="border-b border-r border-slate-200 px-3 py-2"><p className="font-medium text-slate-800">{r.name}</p><p className="text-[11px] text-slate-400">{ROLE_PT[r.role] ?? r.role}</p></td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center font-semibold text-slate-900">{r.done}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{Number.isFinite(r.avgDays) ? `${fmt1(r.avgDays)} d` : "—"}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{Number.isFinite(r.medDays) ? `${fmt1(r.medDays)} d` : "—"}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{pct(r.doneOnTime, r.done)}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{r.openCycles}</td>
                  <td className={`border-b border-r border-slate-200 px-3 py-2 text-center ${r.openAvgAge > 14 ? "font-semibold text-rose-600" : ""}`}>{Number.isFinite(r.openAvgAge) ? `${fmt1(r.openAvgAge)} d` : "—"}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{r.published}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{r.moves}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{r.actions}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{r.activeDays}</td>
                  <td className={`border-b border-r border-slate-200 px-3 py-2 text-center ${r.late ? "font-semibold text-rose-600" : ""}`}>{r.late}</td>
                  <td className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500">{r.last ? new Date(r.last).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : <span className="text-rose-600">nada no período</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <p className="text-sm font-semibold text-slate-800">Etapa a etapa{person !== "all" ? ` · ${nameOf(person)}` : ""}</p>
        <p className="mt-1 text-xs text-slate-500">Cada linha é um ticket que caiu para a pessoa: quando recebeu, quando mandou adiante e quantos dias levou. Em andamento aparece primeiro.</p>
        <div className="mt-3 max-h-[28rem] overflow-auto rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500"><tr>{["Pessoa", "Ticket", "Marca", "Recebeu", "Mandou adiante", "Dias", "Prazo"].map((h) => <th key={h} className="border-b border-r border-slate-200 px-3 py-2 last:border-r-0 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {cycles.filter((c) => (person === "all" || c.userId === person) && (!c.end || c.end >= since)).sort((a, b) => (a.end ? 1 : 0) - (b.end ? 1 : 0) || b.days - a.days).slice(0, 200).map((c, i) => (
                <tr key={`${c.ticketId}-${c.start}`} className={i % 2 ? "bg-slate-50/70" : "bg-white"}>
                  <td className="border-b border-r border-slate-200 px-3 py-1.5 whitespace-nowrap">{nameOf(c.userId)}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-1.5"><span className="block max-w-[360px] truncate" title={c.label}>{c.label}</span>{c.startNote && <span className="text-[10px] text-slate-400">{c.startNote}</span>}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-1.5 whitespace-nowrap">{c.clientId ? clientName(c.clientId) : "—"}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-1.5 whitespace-nowrap">{new Date(c.start).toLocaleDateString("pt-BR")}</td>
                  <td className="border-b border-r border-slate-200 px-3 py-1.5 whitespace-nowrap">{c.end ? new Date(c.end).toLocaleDateString("pt-BR") : <span className="font-semibold text-amber-700">em andamento</span>}</td>
                  <td className={`border-b border-r border-slate-200 px-3 py-1.5 text-center font-semibold ${!c.end && c.days > 14 ? "text-rose-600" : "text-slate-800"}`}>{fmt1(c.days)}</td>
                  <td className={`border-b border-slate-200 px-3 py-1.5 whitespace-nowrap ${c.onTime === false ? "text-rose-600" : c.onTime ? "text-emerald-700" : "text-slate-500"}`}>{new Date(`${c.slaDate}T12:00:00`).toLocaleDateString("pt-BR")}{c.onTime === true ? " ✓" : c.onTime === false ? " atrasou" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={card}>
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Entregas e publicações por semana</p><TrendingUp className="h-4 w-4 text-slate-400" /></div>
          <p className="mt-1 text-xs text-slate-500">Semana começando na segunda (mês-dia). Cor por pessoa.</p>
          <div className="mt-3 h-64">
            {weekly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {weeklyPeople.map((p, i) => <Bar key={p} dataKey={p} stackId="a" fill={PALETTE[i % PALETTE.length]} />)}
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400">Sem entregas no período.</p>}
          </div>
        </div>
        <div className={card}>
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Dias médios por etapa</p><Clock className="h-4 w-4 text-slate-400" /></div>
          <p className="mt-1 text-xs text-slate-500">Tempo entre entrar e sair da etapa (blocos que saíram dela no período). Etapas do cliente em cinza.</p>
          <div className="mt-3 h-64">
            {stageTimes.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageTimes} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="etapa" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, _n, p) => [`${v} dias (${p.payload.n} bloco(s))`, "média"]} />
                  <Bar dataKey="dias" fill="#0891b2" shape={(props: any) => { const { x, y, width, height, payload } = props; return <rect x={x} y={y} width={width} height={height} rx={4} fill={payload.cliente ? "#cbd5e1" : "#0891b2"} />; }} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400">Ainda não há blocos que completaram uma etapa no período.</p>}
          </div>
        </div>
      </div>

      <div className={card}>
        <p className="text-sm font-semibold text-slate-800">Por cliente</p>
        <p className="mt-1 text-xs text-slate-500">O que saiu no período e o que ainda está na fila — para saber o que dá para prometer a cada marca.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500"><tr>{["Marca", "Publicados no período", "Tickets em aberto", "Atrasados"].map((h) => <th key={h} className="border-b border-r border-slate-200 px-3 py-2.5 last:border-r-0">{h}</th>)}</tr></thead>
            <tbody>{byClient.map((c, i) => (
              <tr key={c.name} className={i % 2 ? "bg-slate-50/70" : "bg-white"}>
                <td className="border-b border-r border-slate-200 px-3 py-2 font-medium text-slate-800">{c.name}</td>
                <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{c.published}</td>
                <td className="border-b border-r border-slate-200 px-3 py-2 text-center">{c.open}</td>
                <td className={`border-b border-slate-200 px-3 py-2 text-center ${c.late ? "font-semibold text-rose-600" : ""}`}>{c.late}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";
/**
 * Importar links de customizadores (TXT, um por linha) → publicações.
 * Cola ou sobe o arquivo, o portal descobre marca e bloco de cada link
 * (src/lib/link-import.ts) e mostra a prévia para conferir antes de gravar.
 */
import React, { useMemo, useRef, useState } from "react";
import { X, Upload, AlertTriangle, Check, FileText } from "lucide-react";
import { matchLinks, HOW_LABELS, LinkBlock, LinkClient, LinkPub, LinkMatch } from "@/lib/link-import";

export interface LinkImportRow { blockId: string; url: string; v: number; existingPubId: string | null }

interface Props {
  blocks: LinkBlock[]; clients: LinkClient[]; publications: LinkPub[];
  statusLabel: (status?: string) => string;
  onClose: () => void;
  onApply: (rows: LinkImportRow[], markPublished: boolean) => void;
}

type Choice = { clientId: string | null; blockId: string | null; include: boolean };

export default function LinkImportModal({ blocks, clients, publications, statusLabel, onClose, onApply }: Props) {
  const [text, setText] = useState("");
  const [analyzed, setAnalyzed] = useState<{ matches: LinkMatch[]; ignored: Array<{ line: number; raw: string; why: string }> } | null>(null);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [markPublished, setMarkPublished] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyze = (src: string) => {
    const r = matchLinks(src, { blocks, clients, publications });
    setAnalyzed(r);
    setChoices(Object.fromEntries(r.matches.map((m) => [m.line, { clientId: m.clientId, blockId: m.blockId, include: !!m.blockId && !m.problem }])));
  };
  const readFile = async (f: File) => { const t = await f.text(); setText(t); analyze(t); };

  const pubOf = (blockId: string | null) => (blockId ? publications.filter((p) => p.blockId === blockId).sort((a, b) => b.v - a.v)[0] ?? null : null);
  const rows = useMemo(() => (analyzed?.matches ?? []).map((m) => {
    const c = choices[m.line] ?? { clientId: m.clientId, blockId: m.blockId, include: false };
    const pub = pubOf(c.blockId);
    const version = m.version || pub?.v || 1;
    const kind: "new" | "update" | "same" | "pending" = !c.blockId ? "pending" : !pub ? "new" : pub.url === m.url ? "same" : "update";
    return { m, c, pub, version, kind };
  }), [analyzed, choices]); // eslint-disable-line react-hooks/exhaustive-deps

  const dupBlocks = useMemo(() => {
    const count = new Map<string, number>();
    rows.forEach((r) => { if (r.c.include && r.c.blockId) count.set(r.c.blockId, (count.get(r.c.blockId) ?? 0) + 1); });
    return new Set(Array.from(count.entries()).filter(([, n]) => n > 1).map(([id]) => id));
  }, [rows]);
  const ready = rows.filter((r) => r.c.include && r.c.blockId && r.kind !== "same" && !dupBlocks.has(r.c.blockId!));
  const set = (line: number, patch: Partial<Choice>) => setChoices((prev) => ({ ...prev, [line]: { ...prev[line], ...patch } }));

  const apply = () => {
    onApply(ready.map((r) => ({ blockId: r.c.blockId!, url: r.m.url, v: r.version, existingPubId: r.pub?.id ?? null })), markPublished);
    onClose();
  };

  const chip = (kind: string) => kind === "new" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : kind === "update" ? "bg-sky-50 text-sky-700 border-sky-200" : kind === "same" ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-amber-50 text-amber-700 border-amber-200";
  const selCls = "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-cyan-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-[28px] border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">Importar links (.txt)</p>
            <p className="text-xs text-slate-500">Um link por linha. O portal descobre a marca e o produto de cada um — você confere e grava tudo de uma vez.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!analyzed ? (
            <div className="space-y-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder={"https://explorar.archtechtour.com/greenhouse/ver-23/mesa-jantar-modo/index.html\nhttps://explorar.archtechtour.com/dexco/ver-7/acionamento-para-torneira-de-mesa-redondo/index.html"} className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs leading-6 text-slate-800 outline-none focus:border-cyan-400" />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500"
              >
                <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /> Cole os links acima ou arraste o arquivo .txt para cá.</span>
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"><Upload className="h-3.5 w-3.5" /> Escolher arquivo</button>
                <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readFile(f); }} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{rows.filter((r) => r.kind === "new").length} novas</span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">{rows.filter((r) => r.kind === "update").length} atualizam link existente</span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-500">{rows.filter((r) => r.kind === "same").length} já estão iguais</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{rows.filter((r) => r.kind === "pending").length} para escolher</span>
                <button onClick={() => setAnalyzed(null)} className="ml-auto font-semibold text-slate-500 hover:text-slate-800">← Voltar e editar os links</button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    <tr><th className="px-3 py-2.5 w-8"></th><th className="px-3 py-2.5">Link</th><th className="px-3 py-2.5 w-44">Marca</th><th className="px-3 py-2.5 w-[22rem]">Bloco</th><th className="px-3 py-2.5 w-40">O que acontece</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(({ m, c, pub, version, kind }) => {
                      const pool = blocks.filter((b) => b.clientId === c.clientId).sort((a, b) => a.title.localeCompare(b.title, "pt-BR", { numeric: true }));
                      const cand = m.candidates.map((x) => x.blockId);
                      const first = pool.filter((b) => cand.includes(b.id)).sort((a, b) => cand.indexOf(a.id) - cand.indexOf(b.id));
                      const rest = pool.filter((b) => !cand.includes(b.id));
                      const dup = !!c.blockId && dupBlocks.has(c.blockId);
                      const opt = (b: LinkBlock) => <option key={b.id} value={b.id}>#{b.n ?? "—"} · {b.title}{b.sku ? ` · ${b.sku.slice(0, 28)}` : ""} · {statusLabel(b.status)}{pubOf(b.id) ? " · já tem link" : ""}</option>;
                      return (
                        <tr key={m.line} className={`border-t border-slate-100 align-top ${c.include ? "" : "opacity-60"}`}>
                          <td className="px-3 py-2.5"><input type="checkbox" checked={c.include} disabled={!c.blockId || kind === "same"} onChange={(e) => set(m.line, { include: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-slate-900" /></td>
                          <td className="px-3 py-2.5">
                            <p className="font-mono text-[11px] text-slate-700">{m.alias}{m.version ? ` / ver-${m.version}` : ""} / <b>{m.slug}</b></p>
                            <p className="mt-0.5 text-[10px] text-slate-400">linha {m.line}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <select value={c.clientId ?? ""} onChange={(e) => set(m.line, { clientId: e.target.value || null, blockId: null, include: false })} className={selCls}>
                              <option value="">Escolher marca…</option>
                              {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2.5">
                            <select value={c.blockId ?? ""} onChange={(e) => set(m.line, { blockId: e.target.value || null, include: !!e.target.value })} disabled={!c.clientId} className={`${selCls} ${!c.blockId ? "border-amber-300 bg-amber-50" : ""}`}>
                              <option value="">Escolher bloco…</option>
                              {first.length > 0 && <optgroup label="Parecidos com o link">{first.map(opt)}</optgroup>}
                              <optgroup label={first.length ? "Todos da marca" : "Blocos da marca"}>{rest.map(opt)}</optgroup>
                            </select>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {c.blockId === m.blockId && m.blockId ? `Encontrado por: ${HOW_LABELS[m.how]}${m.how === "similar" ? ` (${Math.round(m.score * 100)}%)` : ""}` : c.blockId ? "Escolhido à mão" : m.problem}
                            </p>
                            {dup && <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" /> Dois links marcados para o mesmo bloco — deixe só um.</p>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${chip(kind)}`}>
                              {kind === "new" ? `Nova publicação · v${version}` : kind === "update" ? `Troca o link · v${pub?.v} → v${version}` : kind === "same" ? "Já está com este link" : "Falta escolher"}
                            </span>
                            {kind === "update" && pub && <p className="mt-1 break-all font-mono text-[10px] text-slate-400" title={pub.url}>era: {pub.url.replace(/^https?:\/\/explorar\.archtechtour\.com\//, "").slice(0, 60)}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {analyzed.ignored.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  <p className="font-semibold text-slate-600">{analyzed.ignored.length} linha(s) ignorada(s)</p>
                  {analyzed.ignored.slice(0, 8).map((i) => <p key={i.line} className="mt-0.5 truncate">linha {i.line}: {i.why} — <span className="font-mono">{i.raw.slice(0, 80)}</span></p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          {analyzed ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={markPublished} onChange={(e) => setMarkPublished(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-slate-900" />
              Marcar esses blocos como <b>Publicado</b> <span className="text-slate-400">(desmarcado = só grava o link, a etapa do bloco não muda)</span>
            </label>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
            {!analyzed
              ? <button onClick={() => analyze(text)} disabled={!text.trim()} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-30">Analisar links</button>
              : <button onClick={apply} disabled={!ready.length} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-2 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-30"><Check className="h-4 w-4" /> Gravar {ready.length} link{ready.length === 1 ? "" : "s"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

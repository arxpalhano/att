"use client";
/**
 * Perfis de acesso — tela do portal. Lista os perfis (padrão + personalizados),
 * mostra quantas pessoas usam cada um e abre o editor com a matriz
 * módulo × (ver / criar / editar / excluir) e as permissões especiais.
 * Tipos, módulos e perfis padrão: src/lib/access.ts.
 */
import React, { useMemo, useState } from "react";
import { Plus, Shield, Copy, Trash2, X, Save, Lock, Users, RotateCcw, AlertTriangle } from "lucide-react";
import {
  AccessProfile, AccessAction, BaseRole, ModulePerm, SpecialPerm,
  ACTION_LABELS, BASE_HINTS, BASE_LABELS, DEFAULT_PROFILES, MODULES, NOT_IN_MATRIX, SPECIALS,
  audienceOf, defaultProfileId, newProfileId, profileOf, summarizeProfile,
} from "@/lib/access";

interface Props {
  profiles: AccessProfile[];
  setProfiles: React.Dispatch<React.SetStateAction<AccessProfile[]>>;
  users: Array<{ id: string; name: string; role: BaseRole; profileId?: string; active?: boolean }>;
  actorName: string;
  perms: { create: boolean; edit: boolean; delete: boolean };
  loadError?: string | null;
}

const ACTIONS: AccessAction[] = ["view", "create", "edit", "delete"];
const btnPrimary = "inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40";
const btnGhost = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40";
const inputCls = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400";

function ProfileEditor({ initial, isNew, onClose, onSave, readOnly }: {
  initial: AccessProfile; isNew: boolean; onClose: () => void; onSave: (p: AccessProfile) => void; readOnly: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [base, setBase] = useState<BaseRole>(initial.base);
  const [modules, setModules] = useState<Record<string, ModulePerm>>(JSON.parse(JSON.stringify(initial.modules || {})));
  const [special, setSpecial] = useState<Partial<Record<SpecialPerm, boolean>>>({ ...(initial.special || {}) });
  const locked = readOnly || initial.id === defaultProfileId("admin");
  const audience = audienceOf(base);
  const mods = MODULES.filter((m) => m.audiences.includes(audience));
  const specials = SPECIALS.filter((s) => s.audiences.includes(audience));

  const toggle = (id: string, a: AccessAction) => setModules((prev) => {
    const cur = { ...(prev[id] || {}) };
    cur[a] = !cur[a];
    // Sem "ver" não faz sentido criar/editar/excluir — e marcar uma ação liga o "ver".
    const def = MODULES.find((m) => m.id === id)!;
    if (a === "view" && !cur.view && def.actions.includes("view")) { cur.create = false; cur.edit = false; cur.delete = false; }
    if (a !== "view" && cur[a] && def.actions.includes("view") && audience !== "client") cur.view = true;
    return { ...prev, [id]: cur };
  });
  const setColumn = (a: AccessAction, on: boolean) => setModules((prev) => {
    const next = { ...prev };
    mods.filter((m) => m.actions.includes(a)).forEach((m) => {
      const cur = { ...(next[m.id] || {}), [a]: on };
      if (a === "view" && !on) { cur.create = false; cur.edit = false; cur.delete = false; }
      if (a !== "view" && on && audience !== "client") cur.view = true;
      next[m.id] = cur;
    });
    return next;
  });

  const save = () => {
    // Guarda só o que existe para o tipo de conta escolhido.
    const clean: Record<string, ModulePerm> = {};
    mods.forEach((m) => {
      const cur = modules[m.id] || {};
      const kept = Object.fromEntries(m.actions.filter((a) => cur[a]).map((a) => [a, true]));
      if (Object.keys(kept).length) clean[m.id] = kept;
    });
    const sp = Object.fromEntries(specials.filter((s) => special[s.id]).map((s) => [s.id, true]));
    onSave({ ...initial, name: name.trim(), description: description.trim() || undefined, base, modules: clean, special: sp });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{isNew ? "Novo perfil de acesso" : locked ? `Perfil ${initial.name}` : `Editar perfil · ${initial.name}`}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>

        {initial.id === defaultProfileId("admin") && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800"><Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> O perfil Admin é travado com acesso total, para ninguém se trancar do lado de fora. Para um admin com menos poderes, crie um perfil novo a partir dele.</p>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><label className="text-xs font-medium text-slate-500">Nome do perfil</label><input value={name} onChange={(e) => setName(e.target.value)} disabled={locked || initial.system} placeholder="Ex.: Comercial, QA, PM" className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-500`} /></div>
          <div>
            <label className="text-xs font-medium text-slate-500">Tipo de conta</label>
            <select value={base} onChange={(e) => setBase(e.target.value as BaseRole)} disabled={locked || !!initial.system || !isNew} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-500`}>
              {(Object.keys(BASE_LABELS) as BaseRole[]).map((b) => <option key={b} value={b}>{BASE_LABELS[b]}</option>)}
            </select>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{BASE_HINTS[base]}. O tipo de conta define <b>quais dados</b> a pessoa enxerga; a matriz abaixo define <b>o que ela pode fazer</b>.{!isNew && !initial.system ? " Não muda depois de criado." : ""}</p>
        <div className="mt-3"><label className="text-xs font-medium text-slate-500">Descrição</label><input value={description} onChange={(e) => setDescription(e.target.value)} disabled={locked} placeholder="Para quem é este perfil" className={`${inputCls} disabled:bg-slate-50`} /></div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Módulo</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="w-24 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {ACTION_LABELS[a]}
                    {!locked && (
                      <span className="mt-1 block space-x-1 text-[10px] font-medium normal-case tracking-normal">
                        <button type="button" onClick={() => setColumn(a, true)} className="text-cyan-700 hover:underline">todos</button>
                        <button type="button" onClick={() => setColumn(a, false)} className="text-slate-400 hover:underline">nenhum</button>
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mods.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{m.label}</p>
                    {m.hint && <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{m.hint}</p>}
                  </td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-2 py-2.5 text-center">
                      {m.actions.includes(a)
                        ? <input type="checkbox" checked={!!modules[m.id]?.[a]} disabled={locked} onChange={() => toggle(m.id, a)} className={`h-4 w-4 rounded border-slate-300 ${a === "delete" ? "accent-rose-600" : "accent-slate-900"}`} />
                        : <span className="text-slate-200">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {audience === "client" && <p className="mt-2 text-[11px] leading-4 text-slate-400">Para cliente, "Ver" pode ser sobreposto por usuário em Usuários → Editar → "Telas liberadas" (a marcação do usuário vence o perfil).</p>}

        {specials.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-800">Permissões especiais</p>
            <div className="mt-2 space-y-2">
              {specials.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="checkbox" checked={!!special[s.id]} disabled={locked} onChange={() => setSpecial({ ...special, [s.id]: !special[s.id] })} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-900" />
                  <span><span className="font-medium text-slate-800">{s.label}</span><span className="block text-[11px] text-slate-400">{s.hint}</span></span>
                </label>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 text-[11px] leading-4 text-slate-400">{NOT_IN_MATRIX}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={btnGhost}>{locked ? "Fechar" : "Cancelar"}</button>
          {!locked && <button onClick={save} disabled={!name.trim()} className={btnPrimary}><Save className="h-3.5 w-3.5" /> Salvar perfil</button>}
        </div>
      </div>
    </div>
  );
}

export default function AccessProfiles({ profiles, setProfiles, users, actorName, perms, loadError }: Props) {
  const [editing, setEditing] = useState<{ profile: AccessProfile; isNew: boolean } | null>(null);
  const activeUsers = useMemo(() => users.filter((u) => u.active !== false), [users]);
  const usersOf = (p: AccessProfile) => activeUsers.filter((u) => profileOf(u, profiles).id === p.id);
  const sorted = useMemo(() => [...profiles].sort((a, b) => Number(!!b.system) - Number(!!a.system) || a.name.localeCompare(b.name)), [profiles]);

  const save = (p: AccessProfile) => {
    const rec: AccessProfile = { ...p, updatedAt: new Date().toISOString(), updatedBy: actorName };
    setProfiles((prev) => (prev.some((x) => x.id === rec.id) ? prev.map((x) => (x.id === rec.id ? rec : x)) : [...prev, rec]));
    setEditing(null);
  };
  const duplicate = (p: AccessProfile) => setEditing({ isNew: true, profile: { ...JSON.parse(JSON.stringify(p)), id: newProfileId(), name: `${p.name} (cópia)`, system: false, updatedAt: undefined, updatedBy: undefined } });
  const remove = (p: AccessProfile) => {
    const n = usersOf(p).length;
    if (!confirm(`Excluir o perfil "${p.name}"?${n ? `\n\n${n} pessoa(s) usam este perfil e voltam para o perfil padrão do tipo de conta (${BASE_LABELS[p.base]}).` : ""}`)) return;
    setProfiles((prev) => prev.filter((x) => x.id !== p.id));
  };
  /** Perfil padrão editado volta ao que está no código (apaga a sobreposição salva). */
  const restore = (p: AccessProfile) => {
    if (!confirm(`Restaurar o perfil "${p.name}" para as permissões originais?`)) return;
    const def = DEFAULT_PROFILES.find((d) => d.id === p.id);
    if (def) setProfiles((prev) => prev.map((x) => (x.id === p.id ? def : x)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Administração</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.25rem]">Perfis de acesso</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Cada perfil define quais módulos a pessoa abre e o que pode fazer em cada um: ver, criar, editar e excluir. O perfil é escolhido no cadastro do usuário.</p>
        </div>
        {perms.create && <button onClick={() => setEditing({ isNew: true, profile: { id: newProfileId(), name: "", base: "internal_ops", modules: JSON.parse(JSON.stringify(DEFAULT_PROFILES.find((d) => d.base === "internal_ops")!.modules)), special: { transition: true } } })} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Novo perfil</button>}
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span><b>Os perfis salvos não carregaram</b> — o portal está usando os perfis padrão e nada do que for editado aqui será gravado. Detalhe: {loadError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((p) => {
          const people = usersOf(p);
          const isAdminProfile = p.id === defaultProfileId("admin");
          const edited = p.system && !!p.updatedAt;
          return (
            <div key={p.id} className="flex flex-col rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.45)]">
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${p.system ? "bg-slate-900 text-white" : "bg-cyan-600 text-white"}`}>{isAdminProfile ? <Lock className="h-5 w-5" /> : <Shield className="h-5 w-5" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-900">{p.name}</p>
                  <p className="text-[11px] text-slate-400">{p.system ? "Perfil padrão" : "Personalizado"} · tipo {BASE_LABELS[p.base]}{edited ? " · editado" : ""}</p>
                </div>
              </div>
              {p.description && <p className="mt-3 text-sm leading-6 text-slate-600">{p.description}</p>}
              <p className="mt-3 text-xs font-semibold text-slate-700">{summarizeProfile(p)}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{MODULES.filter((m) => p.modules?.[m.id]?.view).map((m) => m.label).join(" · ") || "Nenhum módulo"}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500" title={people.map((u) => u.name).join(", ")}><Users className="h-3.5 w-3.5 text-slate-400" /> {people.length} pessoa{people.length === 1 ? "" : "s"}{people.length ? `: ${people.slice(0, 3).map((u) => u.name.split(" ")[0]).join(", ")}${people.length > 3 ? "…" : ""}` : ""}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => setEditing({ profile: p, isNew: false })} className={btnGhost}>{perms.edit && !isAdminProfile ? "Editar permissões" : "Ver permissões"}</button>
                {perms.create && <button onClick={() => duplicate(p)} className={btnGhost} title="Criar um perfil novo a partir deste"><Copy className="h-3.5 w-3.5" /> Duplicar</button>}
                {perms.edit && edited && <button onClick={() => restore(p)} className={btnGhost} title="Voltar às permissões originais"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</button>}
                {perms.delete && !p.system && <button onClick={() => remove(p)} className="ml-auto rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" title="Excluir perfil"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
          );
        })}
      </div>

      {editing && <ProfileEditor initial={editing.profile} isNew={editing.isNew} readOnly={editing.isNew ? !perms.create : !perms.edit} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

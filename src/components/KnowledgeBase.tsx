"use client";
/**
 * Base de Conhecimento (KB) — tela do portal.
 *
 * Auto-contida de propósito: recebe o usuário logado, a lista de usuários (para
 * a administração de acesso) e os registros da KB pelo Portal, e grava POR ITEM
 * em /api/state/kb (POST objeto / DELETE ?id=). Não passa pelo persist com
 * debounce das outras tabelas, porque dois editores gravando a tabela inteira
 * se sobrescreveriam. Toda gravação leva o cabeçalho x-att-actor: o servidor
 * registra quem criou/editou/excluiu no log de atividades.
 */
import React, { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import {
  BookOpen, Briefcase, Megaphone, Cpu, Server, Palette, Wrench, Users, Shield, Box,
  Plus, Search, ArrowLeft, Pencil, Trash2, Save, X, Paperclip, Download, Upload, Settings,
  Lock, ChevronRight, FileText, Image as ImageIcon, FileSpreadsheet, File as FileIcon, Eye, AlertTriangle, Clock,
} from "lucide-react";
import {
  KbArticle, KbAttachment, KbBase, KbRecord, KbUser, KbRole, KbIcon, KbColor, KbAccessList,
  KB_ROLE_LABELS, KB_ALLOWED_EXTENSIONS, KB_MAX_FILE_MB,
  canEditBase, canViewBase, describeAccess, emptyAccess, fmtKbSize, isKbArticle, isKbBase, kbExt, kbId,
} from "@/lib/kb";
import { actorHeaders } from "@/lib/activity-client";

// ------------------------------------------------------------
// Aparência das bases
// ------------------------------------------------------------
const ICONS: Record<KbIcon, React.ComponentType<{ className?: string }>> = {
  briefcase: Briefcase, megaphone: Megaphone, cpu: Cpu, server: Server, book: BookOpen,
  palette: Palette, wrench: Wrench, users: Users, shield: Shield, box: Box,
};
const ICON_LABELS: Record<KbIcon, string> = {
  briefcase: "Comercial", megaphone: "Marketing", cpu: "Tech", server: "TI", book: "Geral",
  palette: "Design", wrench: "Operação", users: "Pessoas", shield: "Segurança", box: "Produto",
};
// Classes completas por cor (o Tailwind só gera o que está escrito literalmente).
const COLORS: Record<KbColor, { tile: string; soft: string; text: string; ring: string; label: string }> = {
  emerald: { tile: "bg-emerald-600 text-white", soft: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", ring: "ring-emerald-300", label: "Verde" },
  sky:     { tile: "bg-sky-600 text-white",     soft: "bg-sky-50 border-sky-200",         text: "text-sky-700",     ring: "ring-sky-300",     label: "Azul" },
  violet:  { tile: "bg-violet-600 text-white",  soft: "bg-violet-50 border-violet-200",   text: "text-violet-700",  ring: "ring-violet-300",  label: "Roxo" },
  amber:   { tile: "bg-amber-500 text-white",   soft: "bg-amber-50 border-amber-200",     text: "text-amber-700",   ring: "ring-amber-300",   label: "Âmbar" },
  rose:    { tile: "bg-rose-600 text-white",    soft: "bg-rose-50 border-rose-200",       text: "text-rose-700",    ring: "ring-rose-300",    label: "Rosa" },
  slate:   { tile: "bg-slate-800 text-white",   soft: "bg-slate-50 border-slate-200",     text: "text-slate-700",   ring: "ring-slate-300",   label: "Cinza" },
  teal:    { tile: "bg-teal-600 text-white",    soft: "bg-teal-50 border-teal-200",       text: "text-teal-700",    ring: "ring-teal-300",    label: "Petróleo" },
  orange:  { tile: "bg-orange-500 text-white",  soft: "bg-orange-50 border-orange-200",   text: "text-orange-700",  ring: "ring-orange-300",  label: "Laranja" },
};
const ALL_ROLES = Object.keys(KB_ROLE_LABELS) as KbRole[];

const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

// ------------------------------------------------------------
// API (por item)
// ------------------------------------------------------------
async function apiSave(rec: KbRecord): Promise<void> {
  const r = await fetch("/api/state/kb", { method: "POST", headers: { "Content-Type": "application/json", ...actorHeaders() }, body: JSON.stringify(rec) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
}
async function apiDelete(id: string): Promise<void> {
  const r = await fetch(`/api/state/kb?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: actorHeaders() });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
}
async function apiDeleteFile(key: string): Promise<void> {
  await fetch(`/api/kb/file?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => {});
}
async function apiUpload(file: File, baseId: string, articleId: string, onProgress: (p: number) => void): Promise<{ key: string }> {
  const r = await fetch("/api/kb/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, fileType: file.type || "application/octet-stream", size: file.size, baseId, articleId }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erro ao preparar o upload");
  const { uploadUrl, key, contentType } = await r.json();
  onProgress(10);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(10 + Math.round((e.loaded / e.total) * 88)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 respondeu ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Falha de rede no envio ao S3 (CORS do bucket libera app.archtechtour.com?)"));
    xhr.send(file);
  });
  onProgress(100);
  return { key };
}
async function apiUnlock(baseId: string, password: string): Promise<boolean> {
  const r = await fetch("/api/kb/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseId, password }) });
  if (r.status === 401) return false;
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return true;
}
/** Bases destravadas nesta sessão do navegador (a senha não é guardada). */
const UNLOCK_KEY = "att_kb_unlocked";
const readUnlocked = (): Set<string> => { try { return new Set(JSON.parse(sessionStorage.getItem(UNLOCK_KEY) || "[]")); } catch { return new Set(); } };
const writeUnlocked = (s: Set<string>) => { try { sessionStorage.setItem(UNLOCK_KEY, JSON.stringify(Array.from(s))); } catch { /* sem storage */ } };

const fileUrl = (a: KbAttachment, inline = false) => `/api/kb/file?key=${encodeURIComponent(a.key)}&name=${encodeURIComponent(a.name)}${inline ? "&inline=1" : ""}`;

// ------------------------------------------------------------
// Markdown (subconjunto) → React
// ------------------------------------------------------------
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((?:https?:\/\/|\/|mailto:)[^)\s]+\))|(https?:\/\/[^\s<>()]+)|(\*[^*\s][^*]*\*)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0]; const k = `${keyBase}-${i++}`;
    if (m[1]) out.push(<code key={k} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k} className="font-semibold text-slate-900">{tok.slice(2, -2)}</strong>);
    else if (m[3]) { const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!; out.push(<a key={k} href={mm[2]} target="_blank" rel="noreferrer" className="text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900">{mm[1]}</a>); }
    else if (m[4]) out.push(<a key={k} href={tok} target="_blank" rel="noreferrer" className="break-all text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900">{tok}</a>);
    else if (m[5]) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0; let k = 0;
  const key = () => `b${k++}`;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("```")) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={key()} className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-[13px] leading-6 text-slate-100"><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length; const content = inline(h[2], key());
      blocks.push(
        lvl === 1 ? <h1 key={key()} className="mt-8 text-2xl font-semibold tracking-tight text-slate-950 first:mt-0">{content}</h1>
        : lvl === 2 ? <h2 key={key()} className="mt-8 border-b border-slate-200 pb-2 text-lg font-semibold text-slate-900 first:mt-0">{content}</h2>
        : <h3 key={key()} className="mt-6 text-[15px] font-semibold text-slate-900 first:mt-0">{content}</h3>,
      );
      i++; continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const raw = lines[i].trim().replace(/^\|/, "").replace(/\|$/, "");
        if (!/^\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*$/.test(raw)) rows.push(raw.split("|").map((c) => c.trim()));
        i++;
      }
      if (rows.length) {
        const [head, ...body] = rows;
        blocks.push(
          <div key={key()} className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50"><tr>{head.map((c, ci) => <th key={ci} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{inline(c, `${k}h${ci}`)}</th>)}</tr></thead>
              <tbody>{body.map((r, ri) => <tr key={ri} className="border-t border-slate-100 align-top">{head.map((_, ci) => <td key={ci} className="px-3 py-2 text-slate-700">{inline(r[ci] ?? "", `${k}r${ri}c${ci}`)}</td>)}</tr>)}</tbody>
            </table>
          </div>,
        );
      }
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key()} className="rounded-r-2xl border-l-4 border-amber-300 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-slate-700">{inline(buf.join(" "), key())}</blockquote>);
      continue;
    }
    const ul = /^\s*[-*]\s+/.test(line); const ol = /^\s*\d+[.)]\s+/.test(line);
    if (ul || ol) {
      const items: string[] = []; const test = ul ? /^\s*[-*]\s+/ : /^\s*\d+[.)]\s+/;
      while (i < lines.length && (test.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (test.test(lines[i])) items.push(lines[i].replace(test, "")); else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      const cls = "my-1 space-y-1.5 pl-6 text-sm leading-6 text-slate-700";
      blocks.push(ul
        ? <ul key={key()} className={`${cls} list-disc marker:text-slate-400`}>{items.map((t, ti) => <li key={ti}>{inline(t, `${k}i${ti}`)}</li>)}</ul>
        : <ol key={key()} className={`${cls} list-decimal marker:font-semibold marker:text-slate-500`}>{items.map((t, ti) => <li key={ti}>{inline(t, `${k}i${ti}`)}</li>)}</ol>);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { blocks.push(<hr key={key()} className="my-6 border-slate-200" />); i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\||>|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) buf.push(lines[i++]);
    blocks.push(<p key={key()} className="text-sm leading-7 text-slate-700">{inline(buf.join(" "), key())}</p>);
  }
  return <div className="space-y-3">{blocks}</div>;
}

// ------------------------------------------------------------
// Pequenos componentes
// ------------------------------------------------------------
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`max-h-[92vh] w-full ${wide ? "max-w-3xl" : "max-w-xl"} overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AttachmentIcon({ name }: { name: string }) {
  const e = kbExt(name);
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".tiff", ".heic"].includes(e)) return <ImageIcon className="h-4 w-4" />;
  if ([".xlsx", ".xls", ".csv"].includes(e)) return <FileSpreadsheet className="h-4 w-4" />;
  if ([".pdf", ".docx", ".doc", ".pptx", ".ppt", ".txt", ".md"].includes(e)) return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

const btnPrimary = "inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40";
const btnGhost = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40";
const inputCls = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400";

// ------------------------------------------------------------
// Lista de acesso (perfis + usuários)
// ------------------------------------------------------------
function AccessEditor({ label, hint, value, onChange, users }: {
  label: string; hint: string; value: KbAccessList; onChange: (v: KbAccessList) => void; users: Props["users"];
}) {
  const [q, setQ] = useState("");
  const toggleRole = (r: KbRole) => onChange({ ...value, roles: value.roles.includes(r) ? value.roles.filter((x) => x !== r) : [...value.roles, r] });
  const toggleUser = (id: string) => onChange({ ...value, userIds: value.userIds.includes(id) ? value.userIds.filter((x) => x !== id) : [...value.userIds, id] });
  const list = users.filter((u) => u.active !== false && u.role !== "admin" && (!q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Grupos (perfis)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALL_ROLES.filter((r) => r !== "admin").map((r) => (
          <button key={r} type="button" onClick={() => toggleRole(r)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${value.roles.includes(r) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
            {value.roles.includes(r) ? "✓ " : ""}{KB_ROLE_LABELS[r]}
          </button>
        ))}
        <span className="self-center text-xs text-slate-400">Admin sempre incluído</span>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Usuários específicos {value.userIds.length ? `(${value.userIds.length})` : ""}</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa…" className={inputCls} />
      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
        {list.map((u) => (
          <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={value.userIds.includes(u.id)} onChange={() => toggleUser(u.id)} className="h-4 w-4 rounded border-slate-300" />
            <span className="flex-1 truncate text-slate-700">{u.name}</span>
            <span className="text-[11px] text-slate-400">{KB_ROLE_LABELS[u.role]}</span>
          </label>
        ))}
        {!list.length && <p className="px-2 py-1 text-xs text-slate-400">Ninguém encontrado.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Formulário de base (admin)
// ------------------------------------------------------------
type BaseFormData = Omit<KbBase, "id" | "kind" | "createdAt" | "updatedAt" | "updatedBy" | "locked" | "passwordHash"> & {
  /** Nova senha (define ou troca). Vazio = mantém a atual. */
  password?: string;
  /** Remove a senha da base. */
  clearPassword?: boolean;
};
function BaseFormModal({ initial, users, onClose, onSave, onDelete, saving }: {
  initial?: KbBase; users: Props["users"]; onClose: () => void; onSave: (b: BaseFormData) => void; onDelete?: () => void; saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState<KbIcon>(initial?.icon ?? "book");
  const [color, setColor] = useState<KbColor>(initial?.color ?? "slate");
  const [order, setOrder] = useState(String(initial?.order ?? 99));
  const [access, setAccess] = useState<KbAccessList>(initial?.access ?? emptyAccess());
  const [editors, setEditors] = useState<KbAccessList>(initial?.editors ?? emptyAccess());
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [clearPassword, setClearPassword] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const Icon = ICONS[icon];
  return (
    <Modal title={initial ? "Configurar base" : "Nova base"} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl ${COLORS[color].tile}`}><Icon className="h-7 w-7" /></div>
          <div className="flex-1 space-y-3">
            <div><label className="text-xs font-medium text-slate-500">Nome</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Base Comercial" className={inputCls} /></div>
            <div><label className="text-xs font-medium text-slate-500">Descrição</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que vive nesta base" className={inputCls} /></div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div><label className="text-xs font-medium text-slate-500">Ícone</label>
            <select value={icon} onChange={(e) => setIcon(e.target.value as KbIcon)} className={inputCls}>{(Object.keys(ICONS) as KbIcon[]).map((k) => <option key={k} value={k}>{ICON_LABELS[k]}</option>)}</select></div>
          <div><label className="text-xs font-medium text-slate-500">Cor</label>
            <select value={color} onChange={(e) => setColor(e.target.value as KbColor)} className={inputCls}>{(Object.keys(COLORS) as KbColor[]).map((k) => <option key={k} value={k}>{COLORS[k].label}</option>)}</select></div>
          <div><label className="text-xs font-medium text-slate-500">Ordem no menu</label><input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className={inputCls} /></div>
        </div>
        <AccessEditor label="Quem pode ver" hint="Grupos inteiros e/ou pessoas específicas. Quem não estiver aqui nem sabe que a base existe." value={access} onChange={setAccess} users={users} />
        <AccessEditor label="Quem pode editar" hint="Cria e edita artigos e anexos. Editor precisa também estar em 'quem pode ver' (ou ser de um grupo liberado)." value={editors} onChange={setEditors} users={users} />
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Lock className="h-4 w-4 text-slate-400" /> Senha da base <span className="font-normal text-slate-400">(opcional)</span></p>
          <p className="mt-0.5 text-xs text-slate-500">Além da liberação por perfil/pessoa, quem abrir a base precisa digitar esta senha uma vez por sessão. Fica guardada só como hash — ninguém consegue lê-la depois.</p>
          {initial?.locked && !clearPassword && <p className="mt-2 text-xs font-semibold text-amber-700">Esta base já tem senha. Deixe em branco para manter.</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); if (e.target.value) setClearPassword(false); }} placeholder={initial?.locked ? "Nova senha (opcional)" : "Definir senha"} autoComplete="new-password" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400" />
            <button type="button" onClick={() => setShowPw(!showPw)} className={btnGhost}><Eye className="h-3.5 w-3.5" /> {showPw ? "Ocultar" : "Mostrar"}</button>
          </div>
          {initial?.locked && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={clearPassword} onChange={(e) => { setClearPassword(e.target.checked); if (e.target.checked) setPassword(""); }} className="h-4 w-4 rounded border-slate-300" /> Remover a senha desta base
            </label>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            {initial && onDelete && (confirm
              ? <div className="flex items-center gap-2 text-xs"><span className="text-rose-700">Apaga a base, os artigos e os anexos. Certeza?</span><button onClick={onDelete} className="rounded-lg bg-rose-600 px-2.5 py-1.5 font-semibold text-white hover:bg-rose-700">Excluir</button><button onClick={() => setConfirm(false)} className="rounded-lg bg-slate-200 px-2.5 py-1.5 font-semibold text-slate-700">Cancelar</button></div>
              : <button onClick={() => setConfirm(true)} className="text-xs font-semibold text-rose-600 hover:underline">Excluir base</button>)}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className={btnGhost}>Cancelar</button>
            <button disabled={!name.trim() || saving} onClick={() => onSave({ name: name.trim(), description: description.trim(), icon, color, order: Number(order) || 99, access, editors, ...(password ? { password } : {}), ...(clearPassword ? { clearPassword: true } : {}) })} className={btnPrimary}><Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// Editor de artigo
// ------------------------------------------------------------
function ArticleEditor({ initial, baseId, sections, onCancel, onSave, saving }: {
  initial?: KbArticle; baseId: string; sections: string[]; onCancel: () => void;
  onSave: (a: Pick<KbArticle, "title" | "section" | "body" | "tags">) => void; saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [section, setSection] = useState(initial?.section ?? sections[0] ?? "Geral");
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [preview, setPreview] = useState(false);
  const listId = `kb-sections-${baseId}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <div><label className="text-xs font-medium text-slate-500">Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do artigo" className={inputCls} autoFocus /></div>
        <div><label className="text-xs font-medium text-slate-500">Seção</label>
          <input list={listId} value={section} onChange={(e) => setSection(e.target.value)} placeholder="Ex.: Ferramentas" className={inputCls} />
          <datalist id={listId}>{sections.map((s) => <option key={s} value={s} />)}</datalist></div>
        <div><label className="text-xs font-medium text-slate-500">Tags (vírgula)</label><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="aws, deploy" className={inputCls} /></div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-500">Conteúdo <span className="text-slate-400">— Markdown: # título, - lista, **negrito**, `código`, [link](url), | tabela |</span></label>
          <button type="button" onClick={() => setPreview(!preview)} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"><Eye className="h-3.5 w-3.5" /> {preview ? "Editar" : "Pré-visualizar"}</button>
        </div>
        {preview
          ? <div className="mt-1 min-h-[300px] rounded-2xl border border-slate-200 bg-white p-5"><MarkdownLite text={body} /></div>
          : <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18} className={`${inputCls} min-h-[300px] resize-y font-mono text-[13px] leading-6`} placeholder={"## Passo a passo\n\n1. Primeiro…\n2. Depois…\n\n> Observação importante"} />}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className={btnGhost}>Cancelar</button>
        <button disabled={!title.trim() || saving} onClick={() => onSave({ title: title.trim(), section: section.trim() || "Geral", body, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) })} className={btnPrimary}><Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar artigo"}</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Anexos
// ------------------------------------------------------------
function Attachments({ article, canEdit, user, onChange }: { article: KbArticle; canEdit: boolean; user: KbUser; onChange: (atts: KbAttachment[]) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; p: number } | null>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const send = async (files: File[]) => {
    setErr("");
    let atts = [...(article.attachments || [])];
    for (const f of files) {
      if (!KB_ALLOWED_EXTENSIONS.includes(kbExt(f.name))) { setErr(`"${f.name}": tipo de arquivo não permitido.`); continue; }
      if (f.size > KB_MAX_FILE_MB * 1024 * 1024) { setErr(`"${f.name}": acima de ${KB_MAX_FILE_MB} MB.`); continue; }
      try {
        setBusy({ name: f.name, p: 0 });
        const { key } = await apiUpload(f, article.baseId, article.id, (p) => setBusy({ name: f.name, p }));
        atts = [...atts, { id: kbId("ka"), key, name: f.name, size: f.size, type: f.type || "application/octet-stream", uploadedAt: new Date().toISOString(), uploadedBy: user.name }];
        await onChange(atts);
      } catch (e) {
        setErr(`"${f.name}": ${(e as Error).message}`);
      }
    }
    setBusy(null);
  };
  const remove = async (a: KbAttachment) => {
    setConfirmId(null);
    await onChange((article.attachments || []).filter((x) => x.id !== a.id));
    await apiDeleteFile(a.key);
  };

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Paperclip className="h-4 w-4 text-slate-400" /> Anexos {article.attachments?.length ? `(${article.attachments.length})` : ""}</p>
        {canEdit && <button onClick={() => inputRef.current?.click()} disabled={!!busy} className={btnGhost}><Upload className="h-3.5 w-3.5" /> Anexar arquivo</button>}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) send(fs); }} />
      </div>
      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const fs = Array.from(e.dataTransfer.files); if (fs.length) send(fs); }}
          className={`mt-3 rounded-2xl border-2 border-dashed px-4 py-4 text-center text-xs transition ${drag ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-400"}`}
        >
          Arraste PDFs, imagens, planilhas, apresentações ou arquivos de design aqui · até {KB_MAX_FILE_MB} MB por arquivo
        </div>
      )}
      {busy && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Enviando <b>{busy.name}</b>… {busy.p}%
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${busy.p}%` }} /></div>
        </div>
      )}
      {err && <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {err}</p>}
      <div className="mt-3 space-y-2">
        {(article.attachments || []).map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><AttachmentIcon name={a.name} /></span>
            <div className="min-w-0 flex-1">
              <a href={fileUrl(a)} className="block truncate text-sm font-semibold text-slate-800 hover:underline" title={a.name}>{a.name}</a>
              <p className="text-[11px] text-slate-400">{fmtKbSize(a.size)} · {a.uploadedBy} · {fmtDateTime(a.uploadedAt)}</p>
            </div>
            {[".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".svg"].includes(kbExt(a.name)) && (
              <a href={fileUrl(a, true)} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Abrir"><Eye className="h-4 w-4" /></a>
            )}
            <a href={fileUrl(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Baixar"><Download className="h-4 w-4" /></a>
            {canEdit && (confirmId === a.id
              ? <div className="flex gap-1"><button onClick={() => remove(a)} className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white">Remover</button><button onClick={() => setConfirmId(null)} className="rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">Não</button></div>
              : <button onClick={() => setConfirmId(a.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remover"><Trash2 className="h-4 w-4" /></button>)}
          </div>
        ))}
        {!article.attachments?.length && !busy && <p className="text-xs text-slate-400">Nenhum anexo{canEdit ? " — use o botão acima ou arraste arquivos." : "."}</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Senha da base
// ------------------------------------------------------------
function PasswordGate({ base, onUnlocked }: { base: KbBase; onUnlocked: () => void }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const Icon = ICONS[base.icon];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pw || busy) return;
    setBusy(true); setErr("");
    try { (await apiUnlock(base.id, pw)) ? onUnlocked() : setErr("Senha incorreta."); }
    catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className={`rounded-[28px] border p-8 ${COLORS[base.color].soft}`}>
      <div className="mx-auto max-w-md text-center">
        <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${COLORS[base.color].tile}`}><Icon className="h-7 w-7" /></span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{base.name}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{base.description}</p>
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Lock className="h-4 w-4 text-slate-400" /> Esta base é protegida por senha</p>
        <form onSubmit={submit} className="mt-3 flex items-center gap-2">
          <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Senha da base" autoFocus autoComplete="off" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
          <button type="button" onClick={() => setShow(!show)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 hover:text-slate-700" title={show ? "Ocultar" : "Mostrar"}><Eye className="h-4 w-4" /></button>
          <button type="submit" disabled={!pw || busy} className={btnPrimary}>{busy ? "Conferindo…" : "Abrir"}</button>
        </form>
        {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
        <p className="mt-3 text-[11px] text-slate-400">Vale até você fechar o navegador. Não sabe a senha? Fale com o admin da base.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------
interface Props {
  user: KbUser;
  users: Array<{ id: string; name: string; email: string; role: KbRole; active?: boolean }>;
  records: KbRecord[];
  setRecords: React.Dispatch<React.SetStateAction<KbRecord[]>>;
  loadError?: string | null;
}

export default function KnowledgeBase({ user, users, records, setRecords, loadError }: Props) {
  const bases = useMemo(() => records.filter(isKbBase).filter((b) => canViewBase(b, user)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)), [records, user]);
  const articles = useMemo(() => records.filter(isKbArticle), [records]);
  const [baseId, setBaseId] = useState<string>("");
  const [articleId, setArticleId] = useState<string>("");
  const [mode, setMode] = useState<"view" | "edit" | "new">("view");
  const [q, setQ] = useState("");
  const [baseModal, setBaseModal] = useState<"new" | "edit" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  useEffect(() => { setUnlocked(readUnlocked()); }, []);
  const isOpen = (b: KbBase) => !b.locked || unlocked.has(b.id);
  const markUnlocked = (id: string) => setUnlocked((prev) => { const n = new Set(prev); n.add(id); writeUnlocked(n); return n; });
  const isAdmin = user.role === "admin";

  const base = bases.find((b) => b.id === baseId) || null;
  const canEdit = base ? canEditBase(base, user) : false;
  const baseArticles = useMemo(() => articles.filter((a) => a.baseId === baseId).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)), [articles, baseId]);
  const sections = useMemo(() => Array.from(new Set(baseArticles.map((a) => a.section || "Geral"))), [baseArticles]);
  const article = baseArticles.find((a) => a.id === articleId) || null;
  const userName = (id: string) => users.find((u) => u.id === id)?.name || id;

  useEffect(() => { if (baseId && !base) { setBaseId(""); setArticleId(""); } }, [baseId, base]);

  // Busca global (só no que o usuário pode ver)
  const results = useMemo(() => {
    const s = q.trim().toLowerCase(); if (s.length < 2) return [];
    const visible = new Set(bases.filter(isOpen).map((b) => b.id));
    return articles.filter((a) => visible.has(a.baseId) && (a.title.toLowerCase().includes(s) || a.body.toLowerCase().includes(s) || a.tags?.some((t) => t.toLowerCase().includes(s)) || a.attachments?.some((x) => x.name.toLowerCase().includes(s)))).slice(0, 30);
  }, [q, articles, bases, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps
  const lockedCount = bases.filter((b) => !isOpen(b)).length;

  const run = async (fn: () => Promise<void>) => {
    setSaving(true); setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };
  const upsertLocal = (rec: KbRecord) => setRecords((prev) => (prev.some((r) => r.id === rec.id) ? prev.map((r) => (r.id === rec.id ? rec : r)) : [...prev, rec]));

  const saveBase = (data: BaseFormData) => run(async () => {
    const now = new Date().toISOString();
    const existing = baseModal === "edit" ? base : null;
    const { password, clearPassword, ...fields } = data;
    const rec: KbBase = { ...(existing ?? { id: kbId("kb"), kind: "base", createdAt: now }), ...fields, kind: "base", updatedAt: now, updatedBy: user.name } as KbBase;
    // O servidor transforma `password` em hash e devolve `locked`; a tela nunca guarda a senha.
    const r = await fetch("/api/state/kb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...rec, ...(password ? { password } : {}), ...(clearPassword ? { clearPassword: true } : {}) }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
    const { locked } = await r.json();
    const saved: KbBase = { ...rec, locked: !!locked, passwordHash: undefined };
    upsertLocal(saved); if (password) markUnlocked(saved.id); setBaseModal(null); setBaseId(saved.id);
  });
  const deleteBase = () => run(async () => {
    if (!base) return;
    for (const a of baseArticles) { for (const att of a.attachments || []) await apiDeleteFile(att.key); await apiDelete(a.id); }
    await apiDelete(base.id);
    setRecords((prev) => prev.filter((r) => r.id !== base.id && !(isKbArticle(r) && r.baseId === base.id)));
    setBaseModal(null); setBaseId(""); setArticleId("");
  });
  const saveArticle = (data: Pick<KbArticle, "title" | "section" | "body" | "tags">) => run(async () => {
    const now = new Date().toISOString();
    const rec: KbArticle = mode === "edit" && article
      ? { ...article, ...data, updatedAt: now, updatedBy: user.name }
      : { id: kbId("ka"), kind: "article", baseId, attachments: [], order: baseArticles.length + 1, createdAt: now, ...data, updatedAt: now, updatedBy: user.name };
    await apiSave(rec); upsertLocal(rec); setArticleId(rec.id); setMode("view");
  });
  const deleteArticle = () => run(async () => {
    if (!article) return;
    for (const att of article.attachments || []) await apiDeleteFile(att.key);
    await apiDelete(article.id);
    setRecords((prev) => prev.filter((r) => r.id !== article.id)); setArticleId(""); setConfirmDelete(false);
  });
  const setAttachments = async (atts: KbAttachment[]) => {
    if (!article) return;
    const rec: KbArticle = { ...article, attachments: atts, updatedAt: new Date().toISOString(), updatedBy: user.name };
    await apiSave(rec); upsertLocal(rec);
  };

  const openArticle = (a: KbArticle) => { setBaseId(a.baseId); setArticleId(a.id); setMode("view"); setQ(""); };

  // ---------- render ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">ArchTechTour</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.25rem]">Base de Conhecimento</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Processos, ferramentas, padrões e contexto de cada área — cada base é liberada por grupo ou por pessoa.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar em todas as bases…" className="w-72 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
          </div>
          {isAdmin && <button onClick={() => setBaseModal("new")} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Nova base</button>}
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span><b>A Base de Conhecimento não carregou.</b> Nada será salvo até isso ser resolvido. Detalhe: {loadError}</span>
        </div>
      )}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      {q.trim().length >= 2 ? (
        <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{results.length} resultado{results.length === 1 ? "" : "s"} para “{q}”{lockedCount > 0 && <span className="ml-2 normal-case tracking-normal text-slate-400">· {lockedCount} base{lockedCount === 1 ? "" : "s"} com senha fora da busca até ser aberta</span>}</p>
          <div className="mt-3 divide-y divide-slate-100">
            {results.map((a) => {
              const b = bases.find((x) => x.id === a.baseId)!; const Icon = ICONS[b.icon];
              const idx = a.body.toLowerCase().indexOf(q.trim().toLowerCase());
              const snippet = idx >= 0 ? a.body.slice(Math.max(0, idx - 60), idx + 100).replace(/\n/g, " ") : a.body.slice(0, 140).replace(/\n/g, " ");
              return (
                <button key={a.id} onClick={() => openArticle(a)} className="flex w-full items-start gap-3 py-3 text-left hover:bg-slate-50">
                  <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${COLORS[b.color].tile}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">{a.title}</span>
                    <span className="block text-[11px] text-slate-400">{b.name} · {a.section}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">…{snippet}…</span>
                  </span>
                  <ChevronRight className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300" />
                </button>
              );
            })}
            {!results.length && <p className="py-6 text-center text-sm text-slate-400">Nada encontrado nas bases que você pode ver.</p>}
          </div>
        </div>
      ) : !bases.length ? (
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-slate-200/80 bg-white/85 px-6 py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] border border-slate-200/80 bg-slate-50/90"><Lock className="h-7 w-7 text-slate-300" /></div>
          <p className="text-sm font-semibold text-slate-700">Nenhuma base liberada para você</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{isAdmin ? "Crie a primeira base com o botão acima." : "Peça ao admin para liberar a base da sua área."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Coluna das bases */}
          <aside className="space-y-2 lg:sticky lg:top-24 lg:self-start">
            {bases.map((b) => {
              const Icon = ICONS[b.icon]; const n = articles.filter((a) => a.baseId === b.id).length; const active = b.id === baseId;
              return (
                <button key={b.id} onClick={() => { setBaseId(b.id); setArticleId(""); setMode("view"); }} className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${active ? `border-transparent bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.5)] ring-2 ${COLORS[b.color].ring}` : "border-slate-200/80 bg-white/70 hover:border-slate-300"}`}>
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${COLORS[b.color].tile}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">{b.name}{b.locked && <Lock className={`h-3.5 w-3.5 flex-shrink-0 ${isOpen(b) ? "text-emerald-500" : "text-slate-400"}`} />}</span>
                    <span className="block text-[11px] text-slate-400">{n} artigo{n === 1 ? "" : "s"}{canEditBase(b, user) ? " · editor" : ""}</span>
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Conteúdo */}
          <section className="min-w-0">
            {!base ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {bases.map((b) => {
                  const Icon = ICONS[b.icon]; const list = articles.filter((a) => a.baseId === b.id);
                  return (
                    <button key={b.id} onClick={() => setBaseId(b.id)} className={`rounded-[28px] border p-6 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${COLORS[b.color].soft}`}>
                      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${COLORS[b.color].tile}`}><Icon className="h-6 w-6" /></span>
                      <p className="mt-4 flex items-center gap-2 text-lg font-semibold text-slate-900">{b.name}{b.locked && <Lock className="h-4 w-4 text-slate-400" />}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{b.description}</p>
                      <p className={`mt-3 text-xs font-semibold ${COLORS[b.color].text}`}>{list.length} artigo{list.length === 1 ? "" : "s"} · {Array.from(new Set(list.map((a) => a.section))).length} seções</p>
                    </button>
                  );
                })}
              </div>
            ) : !isOpen(base) ? (
              <PasswordGate base={base} onUnlocked={() => markUnlocked(base.id)} />
            ) : mode === "new" ? (
              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{base.name}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Novo artigo</h2>
                <div className="mt-5"><ArticleEditor baseId={base.id} sections={sections} onCancel={() => setMode("view")} onSave={saveArticle} saving={saving} /></div>
              </div>
            ) : article ? (
              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button onClick={() => { setArticleId(""); setMode("view"); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-3.5 w-3.5" /> {base.name} · {article.section}</button>
                  {canEdit && mode === "view" && (
                    <div className="flex items-center gap-2">
                      {confirmDelete
                        ? <div className="flex items-center gap-2 text-xs"><span className="text-rose-700">Excluir este artigo e seus anexos?</span><button onClick={deleteArticle} className="rounded-lg bg-rose-600 px-2.5 py-1.5 font-semibold text-white">Excluir</button><button onClick={() => setConfirmDelete(false)} className="rounded-lg bg-slate-200 px-2.5 py-1.5 font-semibold text-slate-700">Cancelar</button></div>
                        : <>
                          <button onClick={() => setMode("edit")} className={btnGhost}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                          <button onClick={() => setConfirmDelete(true)} className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                        </>}
                    </div>
                  )}
                </div>
                {mode === "edit" ? (
                  <div className="mt-5"><ArticleEditor initial={article} baseId={base.id} sections={sections} onCancel={() => setMode("view")} onSave={saveArticle} saving={saving} /></div>
                ) : (
                  <>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{article.title}</h2>
                    <p className="mt-2 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Atualizado {fmtDateTime(article.updatedAt)} por {article.updatedBy}</span>
                      {article.tags?.map((t) => <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">#{t}</span>)}
                    </p>
                    <div className="mt-6">{article.body.trim() ? <MarkdownLite text={article.body} /> : <p className="text-sm text-slate-400">Artigo sem conteúdo ainda.</p>}</div>
                    <Attachments article={article} canEdit={canEdit} user={user} onChange={setAttachments} />
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className={`rounded-[28px] border p-6 ${COLORS[base.color].soft}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {(() => { const Icon = ICONS[base.icon]; return <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${COLORS[base.color].tile}`}><Icon className="h-7 w-7" /></span>; })()}
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{base.name}</h2>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">{base.description}</p>
                        {isAdmin && <p className="mt-2 text-[11px] text-slate-500"><Shield className="mr-1 inline h-3 w-3" />Vê: {describeAccess(base.access, userName)} · Edita: {describeAccess(base.editors, userName)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && <button onClick={() => setBaseModal("edit")} className={btnGhost}><Settings className="h-3.5 w-3.5" /> Configurar base</button>}
                      {canEdit && <button onClick={() => setMode("new")} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Novo artigo</button>}
                    </div>
                  </div>
                </div>
                {!baseArticles.length ? (
                  <div className="rounded-[28px] border border-slate-200/80 bg-white/85 px-6 py-14 text-center">
                    <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">Ainda não há artigos nesta base</p>
                    <p className="mt-1 text-sm text-slate-500">{canEdit ? "Crie o primeiro com “Novo artigo”." : "Quem edita esta base ainda não publicou nada."}</p>
                  </div>
                ) : sections.map((s) => (
                  <div key={s} className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{s}</p>
                    <div className="mt-2 divide-y divide-slate-100">
                      {baseArticles.filter((a) => (a.section || "Geral") === s).map((a) => (
                        <button key={a.id} onClick={() => { setArticleId(a.id); setMode("view"); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-slate-50">
                          <FileText className="h-4 w-4 flex-shrink-0 text-slate-300" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-800">{a.title}</span>
                            <span className="block text-[11px] text-slate-400">{fmtDateTime(a.updatedAt)} · {a.updatedBy}{a.attachments?.length ? ` · ${a.attachments.length} anexo${a.attachments.length === 1 ? "" : "s"}` : ""}</span>
                          </span>
                          {a.tags?.slice(0, 3).map((t) => <span key={t} className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 md:inline">#{t}</span>)}
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {baseModal && (
        <BaseFormModal initial={baseModal === "edit" ? base ?? undefined : undefined} users={users} onClose={() => setBaseModal(null)} onSave={saveBase} onDelete={baseModal === "edit" ? deleteBase : undefined} saving={saving} />
      )}
    </div>
  );
}

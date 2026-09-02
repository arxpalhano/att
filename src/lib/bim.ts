/**
 * Blocos BIM feitos por terceirizados (Danilo, Raquel) — modelo espelhado do
 * acompanhamento que a Jessica mantinha no Notion ("Demandas 2026" de cada
 * freelancer): uma DEMANDA é um lote de produtos de uma marca, com data do
 * pedido, prazo, entrega e status; dentro dela, a lista de produtos e, por
 * produto, os arquivos a entregar (ArchiCAD / Revit / SketchUp).
 *
 * Duas telas usam isto:
 *  - "BIM · Terceirizados" (equipe interna): cria/edita demandas, acompanha
 *    tudo, aprova entrega, vê valor.
 *  - "Minhas demandas" (perfil freelancer_bim): só as demandas do próprio
 *    usuário; marca arquivo a arquivo o que já entregou e sinaliza entrega.
 */

export type BimDemandStatus = "not_started" | "waiting_info" | "in_progress" | "delivered" | "approved";

export const BIM_STATUS_LABELS: Record<BimDemandStatus, string> = {
  not_started: "Não iniciada",
  waiting_info: "Aguardando informação",
  in_progress: "Em andamento",
  delivered: "Entregue",
  approved: "Aprovada",
};

export const BIM_STATUS_COLORS: Record<BimDemandStatus, string> = {
  not_started: "border-slate-200/80 bg-slate-100/90 text-slate-600",
  waiting_info: "border-amber-200/80 bg-amber-50 text-amber-700",
  in_progress: "border-sky-200/80 bg-sky-50 text-sky-700",
  delivered: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  approved: "border-emerald-300 bg-emerald-100 text-emerald-800",
};

/** Ordem em que os status aparecem em filtros e agrupamentos. */
export const BIM_STATUS_ORDER: BimDemandStatus[] = ["not_started", "waiting_info", "in_progress", "delivered", "approved"];

export type BimFormat = "archicad" | "revit" | "sketchup";
export const BIM_FORMAT_LABELS: Record<BimFormat, string> = { archicad: "ArchiCAD", revit: "Revit", sketchup: "SketchUp" };

export interface BimDemandItem {
  id: string;
  /** Bloco do portal, quando o produto já existe lá (permite ligar com o pipeline). */
  blockId?: string;
  /** Código interno no padrão da ATT, ex.: 2025-RS-DESIGN-01-E01-POLTRONA CASULO NIDO */
  code: string;
  name: string;
  /** Formatos pedidos para este produto. */
  formats: BimFormat[];
  /** Formatos já entregues (marcados pelo freelancer). */
  done: BimFormat[];
}

export interface BimDemand {
  id: string;
  /** id do usuário com perfil freelancer_bim */
  freelancerId: string;
  clientId: string;
  /** "Tarefa" no Notion — ex.: "Green House Remessa 03" */
  title: string;
  /** Quantidade declarada de produtos (a lista de itens pode vir depois). */
  productCount: number;
  items: BimDemandItem[];
  status: BimDemandStatus;
  requestedAt: string; // YYYY-MM-DD
  dueAt: string;       // YYYY-MM-DD
  deliveredAt?: string;
  approvedAt?: string;
  /** Valor por produto combinado (visível só para a equipe interna). */
  unitPrice?: number;
  /** Orientações da equipe para o freelancer. */
  notes?: string;
  /** Observações do freelancer para a equipe (dúvidas, pendências). */
  freelancerNotes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Progresso de uma demanda em arquivos: entregues / pedidos. */
export function bimProgress(d: BimDemand): { done: number; total: number; pct: number } {
  const total = d.items.reduce((n, i) => n + i.formats.length, 0);
  const done = d.items.reduce((n, i) => n + i.done.filter((f) => i.formats.includes(f)).length, 0);
  // Sem itens detalhados, o progresso é só pelo status.
  if (total === 0) {
    const pct = d.status === "delivered" || d.status === "approved" ? 100 : d.status === "in_progress" ? 50 : 0;
    return { done: 0, total: 0, pct };
  }
  return { done, total, pct: Math.round((done / total) * 100) };
}

export function bimIsOpen(d: BimDemand): boolean {
  return d.status !== "delivered" && d.status !== "approved";
}

/** Dias até o prazo (negativo = atrasada). Só faz sentido para demanda aberta. */
export function bimDaysLeft(d: BimDemand, now = new Date()): number {
  const due = new Date(`${d.dueAt}T23:59:59`);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

/** Rótulo de mês para agrupar como no Notion ("08. agosto"). */
export function bimMonthKey(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  const m = d.getMonth() + 1;
  const nome = d.toLocaleDateString("pt-BR", { month: "long" });
  return `${String(m).padStart(2, "0")}. ${nome} ${d.getFullYear()}`;
}

/** Gera o slug "Archicad-PoltronaCasuloNido" a partir do nome do produto (padrão do Notion). */
export function bimFileSlug(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^\d{4}-[A-Z0-9-]+-E\d+-/i, "")
    .split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

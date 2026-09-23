"use client";
import React, { useState, useMemo, useEffect, createContext, useContext, useCallback, ReactNode, useRef } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useT } from "@/lib/i18n";
import { BimDemand, BimDemandItem, BimDemandStatus, BimFormat, BIM_STATUS_LABELS, BIM_STATUS_COLORS, BIM_STATUS_ORDER, BIM_FORMAT_LABELS, bimProgress, bimIsOpen, bimDaysLeft, bimMonthKey, bimFileSlug } from "@/lib/bim";
import { FinishCatalog, BlockFinishes, FinishRecord, FinishGroup, catalogId, blockFinishesId, slugId, SUGGESTED_GROUPS, emptyCatalog, emptyBlockFinishes, isFilled } from "@/lib/finishes";
import LanguageSwitcher from "./LanguageSwitcher";
import KnowledgeBase from "./KnowledgeBase";
import AccessProfilesPage from "./AccessProfiles";
import LinkImportModal, { LinkImportRow } from "./LinkImportModal";
import { AccessProfile, AccessAction, SpecialPerm, DEFAULT_PROFILES, MODULES as ACCESS_MODULES, BASE_LABELS, mergeProfiles, profileOf, canDo, hasSpecial, defaultProfileId, summarizeProfile } from "@/lib/access";
import { KbRecord, KbBase, canViewBase, isKbBase } from "@/lib/kb";
import { KB_SEED } from "@/data/kb-seed";
import { ActivityRecord, BLOCK_STATUS_LABELS, TICKET_STATUS_LABELS as SHARED_TICKET_STATUS_LABELS, ENTITY_LABELS, TYPE_LABELS, PAGE_LABELS, isNavigation } from "@/lib/activity";
import { setActivityActor, actorHeaders, logActivity } from "@/lib/activity-client";
import { MIGRATED_BLOCKS, MIGRATED_CONTRACTS, MIGRATED_PUBLICATIONS, MIGRATED_TICKETS } from "@/data/seed";
import {
  LayoutDashboard, Package, FileText, Users, CheckCircle, Activity,
  Globe, Search, Bell, LogOut, Menu, X, Plus, Upload, Clock,
  AlertTriangle, Eye, ChevronDown, ArrowLeft, Copy, Check, Layers,
  Settings, UserCheck, Clipboard, Box, FileUp, ExternalLink, Zap,
  Play, ThumbsUp, ThumbsDown, Hash, Pause, Lock, Archive,
  BarChart3, ChevronRight, Filter, MessageSquare, Sparkles, Send, Bot, RefreshCw, BookOpen, Download
} from "lucide-react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import AnalyticsClientsAdmin from "./AnalyticsClientsAdmin";

// ============================================================
// TYPES & CONSTANTS
// ============================================================
type UserRole = "admin" | "internal_ops" | "internal_modeling" | "internal_programming" | "client" | "freelancer_bim";
type ServiceType = "standard" | "plus" | "ultra";
type Priority = "low" | "normal" | "high" | "urgent";
type BlockStatus =
  | "draft" | "awaiting_client_files" | "client_files_under_review"
  | "ready_to_start" | "in_modeling" | "in_texturing" | "awaiting_client_material_validation"
  | "approved_for_programming" | "in_programming" | "internal_review"
  | "awaiting_client_final_validation" | "approved" | "sketchup_conversion" | "bim_conversion" | "published"
  | "blocked" | "on_hold" | "archived";
type AssetCategory = "cad" | "finishing" | "photos" | "videos" | "technical_drawing" | "3d_block" | "extra_reference";
type TicketStatus = "new" | "in_production" | "internal_review" | "delivered";
type ProductCategory = "moveis" | "luminarias" | "revestimentos" | "metais" | "outros";

interface Brand {
  clientId: string; companyName: string; logoUrl?: string;
  website: string; sector: string; priority: Priority; step: number;
}
interface ProductVariation {
  id: string; name: string; finishes: string; colors: string; materials: string;
}
interface CatalogProduct {
  id: string; clientId: string; name: string; sku: string;
  category: ProductCategory; priority: number; variations: ProductVariation[];
}
export interface ProductionTicket {
  id: string; clientId: string; blockId: string; title: string;
  plan: ServiceType; slaDate: string; priority: Priority;
  assignedTo?: string; status: TicketStatus;
  /** Texto livre: o que precisa ser feito, observações, link de referência. */
  desc?: string;
  /** Quando o ticket nasceu (ISO). Tickets antigos não têm — ver `ticketCreatedAt`. */
  createdAt?: string;
  /** Arquivado = fora das listas e dos alertas, sem apagar. Guarda quando e por quem. */
  archivedAt?: string;
  archivedBy?: string;
}

interface SeedUser {
  id: string; email: string; password: string; name: string; role: UserRole;
  clientId?: string; active: boolean;
  /**
   * Páginas que este usuário pode abrir. Só vale para `role: "client"` — equipe
   * interna acessa tudo. `["all"]` libera tudo. Ausente ou vazio cai no
   * PAGINAS_PADRAO_CLIENTE.
   */
  allowedPages?: string[];
  /** Perfil de acesso (src/lib/access.ts). Ausente = perfil padrão do tipo de conta (`role`). */
  profileId?: string;
}
interface SeedClient { id: string; name: string; code: string; contactEmail: string; active: boolean; }
export interface SeedContract {
  id: string; clientId: string; title: string;
  totalBlocks: number; usedBlocks: number; startDate: string; active: boolean;
}
export interface SeedBlock {
  id: string; clientId: string; contractId: string; n: number;
  sku: string; csku: string; title: string; desc?: string;
  svc: ServiceType; status: BlockStatus; pri: Priority;
  owner?: string; backup?: string; created: string; published?: string;
  clientRevisions?: number; // número de revisões solicitadas pelo cliente
  /** Arquivos BIM já entregues (espelho dos checkboxes SKP/RVT/GSM do Notion). */
  bim?: { skp: boolean; rvt: boolean; gsm: boolean };
  /** Modelador responsável (texto livre — no Notion era "pessoa"). */
  modeler?: string;
  /**
   * Data de entrega geral do bloco. Automática = `materialsAt` + SLA_DAYS; quando
   * alguém digita a data, `dueManual` fica true e o automático para de mexer nela.
   */
  dueDate?: string;
  dueManual?: boolean;
  /** Dia em que o cliente entregou os materiais (reinicia se ele precisar reenviar). */
  materialsAt?: string;
  /** Rastreabilidade da importação do Notion (Banco de Produtos). */
  notionUrl?: string;
  notionCode?: string;
  notionTech?: string;
  importedAt?: string;
}
interface SeedAsset {
  id: string; blockId: string; cat: AssetCategory;
  name: string; size: number; v: number; by: string;
  /** Chave do objeto no S3 (clientes/<clientId>/blocos/<blockId>/<cat>/<ts>_<nome>). Sem ela não há download. */
  key?: string;
  analysis?: { score: number; approved: boolean; summary: string; issues: string[]; suggestions: string[]; notes?: string[]; };
  uploadedAt?: string;
}
/** Registro do log de atividades — gravado pelo servidor (src/lib/activity.ts). */
type SeedActivity = ActivityRecord;
export interface SeedPub {
  id: string; blockId: string; url: string;
  embed: string; env: string; v: number;
}

// Rótulos vivem em src/lib/activity.ts (o servidor usa os mesmos para descrever o log).
const STATUS_LABELS = BLOCK_STATUS_LABELS as Record<BlockStatus, string>;

const STATUS_COLORS: Record<BlockStatus, string> = {
  draft: "border-slate-200/80 bg-slate-100/90 text-slate-600",
  awaiting_client_files: "border-amber-200/80 bg-amber-50 text-amber-700",
  client_files_under_review: "border-sky-200/80 bg-sky-50 text-sky-700",
  ready_to_start: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  in_modeling: "border-violet-200/80 bg-violet-50 text-violet-700",
  in_texturing: "border-pink-200/80 bg-pink-50 text-pink-700",
  awaiting_client_material_validation: "border-orange-200/80 bg-orange-50 text-orange-700",
  approved_for_programming: "border-cyan-200/80 bg-cyan-50 text-cyan-700",
  in_programming: "border-indigo-200/80 bg-indigo-50 text-indigo-700",
  internal_review: "border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-700",
  awaiting_client_final_validation: "border-amber-200/80 bg-amber-50 text-amber-700",
  approved: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  sketchup_conversion: "border-orange-200/80 bg-orange-50 text-orange-700",
  bim_conversion: "border-teal-200/80 bg-teal-50 text-teal-700",
  published: "border-emerald-300/80 bg-emerald-500/10 text-emerald-700",
  blocked: "border-rose-200/80 bg-rose-50 text-rose-700",
  on_hold: "border-slate-200/80 bg-slate-100/70 text-slate-500",
  archived: "border-slate-200/60 bg-slate-50 text-slate-400",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "text-slate-400", normal: "text-cyan-600", high: "text-amber-600", urgent: "text-rose-600",
};
const PRIORITY_LABELS: Record<Priority, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
const SERVICE_LABELS: Record<ServiceType, string> = { standard: "Standard", plus: "Plus", ultra: "Ultra" };
const SERVICE_COLORS: Record<ServiceType, string> = {
  standard: "border-slate-200/80 bg-slate-100/80 text-slate-600",
  plus: "border-cyan-200/80 bg-cyan-50 text-cyan-700",
  ultra: "border-violet-200/80 bg-violet-50 text-violet-700",
};
const ROLE_LABELS: Record<UserRole, string> = { admin: "Admin", internal_ops: "Operações", internal_modeling: "Modelagem", internal_programming: "Programação", client: "Cliente", freelancer_bim: "Terceirizado BIM" };
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  cad: "CAD / Estrutural", finishing: "Acabamento / Material", photos: "Fotos do produto",
  videos: "Vídeos", technical_drawing: "Desenho Técnico", "3d_block": "Bloco 3D",
  extra_reference: "Ref. Extra",
};
const CATEGORY_HINTS: Partial<Record<AssetCategory, string>> = {
  photos: "Fotos reais do produto: frente, lateral, topo, perspectiva e close-ups de detalhes",
  finishing: "Catálogo de acabamentos/cores: amostras de madeira, tecido, metal, etc.",
  cad: "Arquivo CAD do produto: .skp, .obj, .fbx, .step, .dwg, etc.",
  technical_drawing: "Projeto executivo com cotas e dimensões reais",
  videos: "Vídeo mostrando mecanismos, aberturas ou detalhes difíceis de fotografar",
  "3d_block": "Modelo 3D completo enviado pelo cliente (referência ou base)",
};
const READINESS_RULES: Record<ServiceType, AssetCategory[]> = {
  standard: ["cad", "finishing", "photos"],
  plus: ["cad", "finishing", "photos", "technical_drawing"],
  ultra: ["cad", "finishing", "photos", "technical_drawing", "videos", "3d_block"],
};
/** Fases que geram ticket na fila quando o bloco entra nelas sem ticket aberto. */
const PRODUCTION_PHASE_LABELS: Partial<Record<BlockStatus, string>> = {
  ready_to_start: "Modelagem", in_modeling: "Modelagem", in_texturing: "Texturização",
  approved_for_programming: "Programação", in_programming: "Programação",
  sketchup_conversion: "Conversão SketchUp", bim_conversion: "Conversão BIM",
};
const VALID_TRANSITIONS: Record<BlockStatus, BlockStatus[]> = {
  draft: ["awaiting_client_files", "blocked", "on_hold", "archived"],
  awaiting_client_files: ["client_files_under_review", "blocked", "on_hold", "archived"],
  client_files_under_review: ["ready_to_start", "awaiting_client_files", "blocked", "on_hold"],
  ready_to_start: ["in_modeling", "blocked", "on_hold"],
  in_modeling: ["in_texturing", "awaiting_client_material_validation", "blocked", "on_hold"],
  // Ajuste de textura num produto que já passou pela validação vai direto para a
  // programação, sem o cliente validar material de novo (Victor, 2026-09-24).
  in_texturing: ["awaiting_client_material_validation", "approved_for_programming", "in_modeling", "blocked", "on_hold"],
  awaiting_client_material_validation: ["approved_for_programming", "in_texturing", "in_modeling", "blocked", "on_hold"],
  approved_for_programming: ["in_programming", "blocked", "on_hold"],
  in_programming: ["internal_review", "blocked", "on_hold"],
  internal_review: ["awaiting_client_final_validation", "in_programming", "blocked", "on_hold"],
  awaiting_client_final_validation: ["approved", "internal_review", "in_texturing", "in_modeling", "blocked", "on_hold"],
  // Depois de aprovado: SketchUp → BIM → publicado (Igor, 2026-09-18). O SKP só
  // começa com o customizador aprovado, senão ajuste de modelagem vira retrabalho
  // em SKP e em BIM. approved → bim_conversion segue aceito para blocos antigos.
  approved: ["sketchup_conversion", "bim_conversion", "published", "in_texturing", "in_modeling", "approved_for_programming"],
  sketchup_conversion: ["bim_conversion", "published", "approved"],
  bim_conversion: ["published", "sketchup_conversion", "approved"],
  // Publicado não é fim de linha: ajuste de modelagem/textura reabre o ciclo e
  // volta para a programação republicar (Jéssica/Victor, 2026-09-24). Também
  // vale de Aprovado / Validação Final.
  published: ["in_modeling", "in_texturing", "approved_for_programming", "sketchup_conversion", "bim_conversion", "archived"],
  blocked: ["draft", "awaiting_client_files", "ready_to_start", "in_modeling", "in_texturing", "in_programming", "archived"],
  on_hold: ["draft", "awaiting_client_files", "ready_to_start", "in_modeling", "in_texturing", "in_programming", "archived"],
  archived: [],
};

// ============================================================
// SEED DATA
// ============================================================
let USERS: SeedUser[] = [
  { id: "u1", email: "mpesca@archtechtour.com", password: "arch@2025", name: "Mariana Pesca", role: "admin", active: true },
  { id: "u2", email: "mpalhano@archtechtour.com", password: "arch@2025", name: "Matheus Palhano", role: "admin", active: true },
  { id: "u3", email: "vsalles@archtechtour.com", password: "arch@2025", name: "Victor Salles", role: "internal_modeling", active: true },
  { id: "u4", email: "ijesus@archtechtour.com", password: "arch@2025", name: "Igor Augusto", role: "internal_modeling", active: true },
  { id: "u5", email: "lliles@archtechtour.com", password: "arch@2025", name: "Lucas Liles", role: "internal_programming", active: true },
  // PM — precisa de admin para editar contratos/clientes/publicações. O login SSO
  // só promove a admin quem NÃO está neste seed, então quem está aqui herda este papel.
  { id: "u6", email: "info@archtechtour.com", password: "arch@2025", name: "Jéssica Ribeiro", role: "admin", active: true },
  { id: "u7", email: "financeiro@archtechtour.com", password: "arch@2025", name: "Danielli Nunes", role: "internal_ops", active: true },
  { id: "u8", email: "contato@escal.com.br", password: "escal@2025", name: "Escal Móveis", role: "client", clientId: "c1", active: true },
  { id: "u9", email: "contato@estudiobola.com.br", password: "bola@2025", name: "Estúdio Bola", role: "client", clientId: "c2", active: true },
  { id: "u10", email: "contato@wentz.com.br", password: "wentz@2025", name: "Wentz", role: "client", clientId: "c3", active: true },
  { id: "u11", email: "contato@minimaldesign.com.br", password: "minimal@2025", name: "Minimal Design", role: "client", clientId: "c4", active: true },
  { id: "u12", email: "contato@rsdesign.com.br", password: "rsdesign@2025", name: "RS Design", role: "client", clientId: "c5", active: true },
  { id: "u13", email: "contato@wjluminarias.com.br",   password: "wj@2025",            name: "WJ Luminárias",   role: "client", clientId: "c11", active: true },
  { id: "u14", email: "contato@tidelli.com.br",        password: "tidelli@2025",       name: "Tidelli",         role: "client", clientId: "c6",  active: true },
  { id: "u15", email: "contato@hunterdouglas.com.br",  password: "hd@2025",            name: "Hunter Douglas",  role: "client", clientId: "c7",  active: true },
  { id: "u16", email: "contato@docol.com.br",          password: "docol@2025",         name: "Docol",           role: "client", clientId: "c8",  active: true },
  { id: "u17", email: "contato@pedrofranco.com.br",    password: "pedrofranco@2025",   name: "Pedro Franco",    role: "client", clientId: "c9",  active: true },
  { id: "u18", email: "contato@dexco.com.br",          password: "dexco@2025",         name: "DEXCO",           role: "client", clientId: "c10", active: true },
  { id: "u19", email: "contato@christie.com.br",       password: "christie@2025",      name: "Christie",        role: "client", clientId: "c12", active: true },
  { id: "u20", email: "contato@cadeirasrosa.com.br",   password: "cadeirasrosa@2025",  name: "Cadeiras Rosa",   role: "client", clientId: "c13", active: true },
  { id: "u21", email: "contato@jaderalmeida.com",      password: "jader@2025",         name: "Jader Almeida",   role: "client", clientId: "c14", active: true },
  { id: "u22", email: "contato@arctefacto.com.br",     password: "arctefacto@2025",    name: "Arctefacto",      role: "client", clientId: "c15", active: true },
  { id: "u23", email: "contato@greenhouse.com.br",      password: "greenhouse@2025",    name: "Green House",     role: "client", clientId: "c16", active: true },
  { id: "u24", email: "contato@persol.com.br",          password: "persol@2025",        name: "Persol",          role: "client", clientId: "c17", active: true },
  { id: "u25", email: "contato@ricco.com.br",           password: "ricco@2025",         name: "Riccó",           role: "client", clientId: "c18", active: true },
];

let CLIENTS: SeedClient[] = [
  // codes em lowercase para casar com dim_client_alias do Athena (analytics)
  { id: "c1",  name: "Escal Móveis",   code: "escal",        contactEmail: "contato@escal.com.br", active: true },
  { id: "c2",  name: "Estúdio Bola",   code: "estudiobola",  contactEmail: "contato@estudiobola.com.br", active: true },
  { id: "c3",  name: "Wentz",          code: "wentz",        contactEmail: "contato@wentz.com.br", active: true },
  { id: "c4",  name: "Minimal Design", code: "minimal",      contactEmail: "contato@minimaldesign.com.br", active: true },
  { id: "c5",  name: "RS Design",      code: "rsdesign",     contactEmail: "contato@rsdesign.com.br", active: true },
  { id: "c6",  name: "Tidelli",        code: "tidelli",      contactEmail: "contato@tidelli.com.br", active: true },
  { id: "c7",  name: "Hunter Douglas", code: "hd",           contactEmail: "contato@hunterdouglas.com.br", active: true },
  { id: "c8",  name: "Docol",          code: "docol",        contactEmail: "contato@docol.com.br", active: true },
  { id: "c9",  name: "Pedro Franco",   code: "pedrofranco",  contactEmail: "contato@pedrofranco.com.br", active: true },
  { id: "c10", name: "DEXCO",          code: "dexco",        contactEmail: "contato@dexco.com.br", active: true },
  { id: "c11", name: "WJ Luminárias",  code: "wj",           contactEmail: "contato@wjluminarias.com.br", active: true },
  { id: "c12", name: "Christie",       code: "christie",     contactEmail: "contato@christie.com.br", active: true },
  { id: "c13", name: "Cadeiras Rosa",  code: "cadeirasrosa", contactEmail: "contato@cadeirasrosa.com.br", active: true },
  { id: "c14", name: "Jader Almeida",  code: "jader",        contactEmail: "contato@jaderalmeida.com", active: true },
  { id: "c15", name: "Arctefacto",     code: "arctefacto",   contactEmail: "contato@arctefacto.com.br", active: true },
  { id: "c16", name: "Green House",    code: "greenhouse",   contactEmail: "contato@greenhouse.com.br", active: true },
  { id: "c17", name: "Persol",         code: "persol",       contactEmail: "contato@persol.com.br", active: true },
  { id: "c18", name: "Riccó",          code: "ricco",        contactEmail: "contato@ricco.com.br", active: true },
];

let CONTRACTS: SeedContract[] = [
  { id: "ct1", clientId: "c1", title: "Contrato 2025 – Linha Completa", totalBlocks: 100, usedBlocks: 12, startDate: "2025-01-15", active: true },
  { id: "ct2", clientId: "c2", title: "Contrato Inicial – MVP", totalBlocks: 30, usedBlocks: 5, startDate: "2025-04-01", active: true },
  { id: "ct3", clientId: "c3", title: "Piloto Haus Concept", totalBlocks: 10, usedBlocks: 2, startDate: "2025-06-01", active: true },
  { id: "ct8", clientId: "c11", title: "Contrato WJ Luminárias 2025 – Linha Completa", totalBlocks: 21, usedBlocks: 20, startDate: "2025-10-01", active: true },
];

const INITIAL_BLOCKS: SeedBlock[] = [
  // ESCAL
  { id: "pb1", clientId: "c1", contractId: "ct1", n: 1, sku: "ESCAL-001", csku: "BANCO-NUB", title: "Banco Nub", svc: "plus", status: "published", pri: "normal", owner: "u3", backup: "u5", created: "2025-03-15", published: "2025-07-23" },
  { id: "pb2", clientId: "c1", contractId: "ct1", n: 2, sku: "ESCAL-002", csku: "BANQUETA-LOAI", title: "Banqueta Loai", svc: "plus", status: "in_programming", pri: "high", owner: "u5", created: "2025-05-01" },
  { id: "pb3", clientId: "c1", contractId: "ct1", n: 3, sku: "ESCAL-003", csku: "PUFF-UMMA", title: "Puff Umma", svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2025-06-01" },
  { id: "pb4", clientId: "c1", contractId: "ct1", n: 4, sku: "ESCAL-004", csku: "POLTRONA-MARGOT", title: "Poltrona Margot", svc: "plus", status: "awaiting_client_material_validation", pri: "high", owner: "u3", created: "2025-06-15" },
  { id: "pb5", clientId: "c1", contractId: "ct1", n: 5, sku: "ESCAL-005", csku: "MESA-AUX-MARY", title: "Mesa Auxiliar Mary", svc: "standard", status: "published", pri: "normal", owner: "u5", created: "2025-04-01", published: "2025-08-15" },
  { id: "pb6", clientId: "c1", contractId: "ct1", n: 6, sku: "ESCAL-006", csku: "MESA-AUX-STEEL", title: "Mesa Auxiliar Steel", svc: "standard", status: "internal_review", pri: "normal", owner: "u5", created: "2025-07-01" },
  // ESTÚDIO BOLA
  { id: "pb7", clientId: "c2", contractId: "ct2", n: 1, sku: "EB-001", csku: "POLTRONA-ACACIA", title: "Poltrona Acácia", svc: "ultra", status: "awaiting_client_final_validation", pri: "high", owner: "u3", created: "2024-08-01" },
  { id: "pb8", clientId: "c2", contractId: "ct2", n: 2, sku: "EB-002", csku: "BANCO-PIAO", title: "Banco Pião", svc: "plus", status: "published", pri: "normal", owner: "u5", created: "2024-09-01", published: "2025-02-10" },
  { id: "pb9", clientId: "c2", contractId: "ct2", n: 3, sku: "EB-003", csku: "POLTRONA-LALA", title: "Poltrona Lalá", svc: "plus", status: "published", pri: "normal", owner: "u3", created: "2024-10-01", published: "2025-03-20" },
  { id: "pb10", clientId: "c2", contractId: "ct2", n: 4, sku: "EB-004", csku: "BANCO-LESS", title: "Banco Less", svc: "standard", status: "published", pri: "normal", owner: "u4", created: "2024-11-01", published: "2025-04-05" },
  { id: "pb11", clientId: "c2", contractId: "ct2", n: 5, sku: "EB-005", csku: "CADEIRA-COTA", title: "Cadeira Cota", svc: "plus", status: "in_programming", pri: "high", owner: "u5", created: "2025-08-01" },
  { id: "pb12", clientId: "c2", contractId: "ct2", n: 6, sku: "EB-006", csku: "LATERAL-ARDEA", title: "Lateral Ardea", svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2025-09-15" },
  { id: "pb13", clientId: "c2", contractId: "ct2", n: 7, sku: "EB-007", csku: "SOFA-BLOCK", title: "Sofá Block", svc: "ultra", status: "ready_to_start", pri: "urgent", created: "2025-11-01" },
  { id: "pb14", clientId: "c2", contractId: "ct2", n: 8, sku: "EB-008", csku: "JANTAR-TRIZ", title: "Jantar Triz Madeira", svc: "plus", status: "approved", pri: "normal", owner: "u3", created: "2025-10-01" },
  // WENTZ
  { id: "pb15", clientId: "c3", contractId: "ct3", n: 1, sku: "WENTZ-001", csku: "CADEIRA-CAPA", title: "Cadeira Capa", svc: "plus", status: "published", pri: "normal", owner: "u3", created: "2025-01-15", published: "2025-06-10" },
  { id: "pb16", clientId: "c3", contractId: "ct3", n: 2, sku: "WENTZ-002", csku: "POLTRONA-DAMA", title: "Poltrona Dama", svc: "ultra", status: "in_programming", pri: "high", owner: "u5", backup: "u3", created: "2025-03-01" },
  // MINIMAL DESIGN
  { id: "pb17", clientId: "c4", contractId: "ct4", n: 1, sku: "MINIMAL-001", csku: "CABINE-PLAY-XP", title: "Cabine Play Extra Pequena", svc: "standard", status: "published", pri: "normal", owner: "u5", created: "2025-07-15", published: "2025-11-01" },
  { id: "pb18", clientId: "c4", contractId: "ct4", n: 2, sku: "MINIMAL-002", csku: "CABINE-PLAY-P", title: "Cabine Play Pequena", svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2025-08-01" },
  { id: "pb19", clientId: "c4", contractId: "ct4", n: 3, sku: "MINIMAL-003", csku: "CABINE-BINE-P", title: "Cabine Bine Pequena", svc: "standard", status: "awaiting_client_files", pri: "normal", created: "2025-09-01" },
  // DEXCO
  { id: "pb20", clientId: "c10", contractId: "ct7", n: 1, sku: "DEXCO-001", csku: "PROD-VALIDACAO", title: "Produto Validação Dexco", svc: "standard", status: "draft", pri: "normal", created: "2026-03-02" },
  // WJ LUMINÁRIAS — 20 publicados (links reais Notion/Banco de Produtos) + 1 pendente
  { id: "pb21", clientId: "c11", contractId: "ct8", n: 1,  sku: "2025-WJ-E01-01", csku: "BASAL",             title: "Basal",              svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb22", clientId: "c11", contractId: "ct8", n: 2,  sku: "2025-WJ-E01-02", csku: "CANOVA-M",          title: "Canova M",           svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb23", clientId: "c11", contractId: "ct8", n: 3,  sku: "2025-WJ-E01-03", csku: "CORDEL",            title: "Cordel",             svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb24", clientId: "c11", contractId: "ct8", n: 4,  sku: "2025-WJ-E01-04", csku: "CUPULO",            title: "Cúpulo",             svc: "plus", status: "internal_review",   pri: "normal", owner: "u5", backup: "u3", created: "2025-10-27", published: "2025-11-11" },
  { id: "pb25", clientId: "c11", contractId: "ct8", n: 5,  sku: "2025-WJ-E01-05", csku: "DOCE",              title: "Doce",               svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb26", clientId: "c11", contractId: "ct8", n: 6,  sku: "2025-WJ-E01-06", csku: "DUNAS-LINEAR",      title: "Dunas Linear",       svc: "plus", status: "published",   pri: "normal", owner: "u5", backup: "u3", created: "2025-10-27", published: "2026-03-09" },
  { id: "pb27", clientId: "c11", contractId: "ct8", n: 7,  sku: "2025-WJ-E01-07", csku: "ENIGMA",            title: "Enigma",             svc: "plus", status: "internal_review",   pri: "normal", owner: "u5", backup: "u3", created: "2025-10-27", published: "2025-11-11" },
  { id: "pb28", clientId: "c11", contractId: "ct8", n: 8,  sku: "2025-WJ-E01-08", csku: "FACIA",             title: "Facia",              svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb29", clientId: "c11", contractId: "ct8", n: 9,  sku: "2025-WJ-E01-09", csku: "ICE",               title: "Ice",                svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb30", clientId: "c11", contractId: "ct8", n: 10, sku: "2025-WJ-E01-10", csku: "IMPERIAL",          title: "Imperial",           svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb31", clientId: "c11", contractId: "ct8", n: 11, sku: "2025-WJ-E01-11", csku: "MEGA-BASE-PEDRA",   title: "Mega Base Pedra",    svc: "plus", status: "published",   pri: "normal", owner: "u5", backup: "u3", created: "2025-10-27", published: "2026-03-25" },
  { id: "pb32", clientId: "c11", contractId: "ct8", n: 12, sku: "2025-WJ-E01-12", csku: "MIDE",              title: "Mide",               svc: "plus", status: "published",   pri: "normal", owner: "u5", backup: "u3", created: "2025-10-27", published: "2026-03-11" },
  { id: "pb33", clientId: "c11", contractId: "ct8", n: 13, sku: "2025-WJ-E01-13", csku: "ORI",               title: "Ori",                svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-03-12" },
  { id: "pb34", clientId: "c11", contractId: "ct8", n: 14, sku: "2025-WJ-E01-14", csku: "SAMURAI-PISO",      title: "Samurai Piso",       svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb35", clientId: "c11", contractId: "ct8", n: 15, sku: "2025-WJ-E01-15", csku: "SAMURAI-TETO",      title: "Samurai Teto",       svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb36", clientId: "c11", contractId: "ct8", n: 16, sku: "2025-WJ-E01-16", csku: "SOLITARIO-CRISTAL", title: "Solitário Cristal",  svc: "plus", status: "published",   pri: "normal", owner: "u5", backup: "u3", created: "2025-10-27", published: "2026-03-12" },
  { id: "pb37", clientId: "c11", contractId: "ct8", n: 17, sku: "2025-WJ-E01-17", csku: "UMBRA",             title: "Umbra",              svc: "plus", status: "published",   pri: "normal", owner: "u5", backup: "u3", created: "2025-10-27", published: "2026-03-24" },
  { id: "pb38", clientId: "c11", contractId: "ct8", n: 18, sku: "2025-WJ-E01-18", csku: "VELA",              title: "Vela",               svc: "plus", status: "internal_review",   pri: "high",   owner: "u5", backup: "u3", created: "2025-10-27", published: "2026-03-11" },
  { id: "pb39", clientId: "c11", contractId: "ct8", n: 19, sku: "2025-WJ-E01-19", csku: "VERTICE",           title: "Vértice",            svc: "plus", status: "published",   pri: "normal", owner: "u5", backup: "u3", created: "2025-10-27", published: "2026-03-12" },
  { id: "pb40", clientId: "c11", contractId: "ct8", n: 20, sku: "2025-WJ-E01-20", csku: "ENIGMA-VERTICAL",   title: "Enigma Vertical",    svc: "plus", status: "published",   pri: "normal", owner: "u3", backup: "u5", created: "2025-10-27", published: "2026-01-22" },
  { id: "pb41", clientId: "c11", contractId: "ct8", n: 21, sku: "2025-WJ-E01-21", csku: "ELO-TETO",          title: "Elo Teto",           svc: "standard", status: "in_modeling", pri: "high", owner: "u5", created: "2026-04-29" },
];

const ASSETS: SeedAsset[] = [
  { id: "a1", blockId: "pb1", cat: "cad", name: "banco_nub_v3.step", size: 3200000, v: 3, by: "u8" },
  { id: "a2", blockId: "pb1", cat: "finishing", name: "acabamentos_nub.pdf", size: 1800000, v: 1, by: "u8" },
  { id: "a3", blockId: "pb1", cat: "photos", name: "banco_nub_ref.jpg", size: 520000, v: 1, by: "u8" },
  { id: "a4", blockId: "pb1", cat: "technical_drawing", name: "nub_desenho_tecnico.pdf", size: 980000, v: 1, by: "u8" },
  { id: "a5", blockId: "pb2", cat: "cad", name: "banqueta_loai.step", size: 2800000, v: 2, by: "u8" },
  { id: "a6", blockId: "pb2", cat: "finishing", name: "acabamentos_loai.pdf", size: 1500000, v: 1, by: "u8" },
  { id: "a7", blockId: "pb2", cat: "photos", name: "loai_foto.jpg", size: 450000, v: 1, by: "u8" },
  { id: "a8", blockId: "pb7", cat: "cad", name: "poltrona_acacia_v4.step", size: 5800000, v: 4, by: "u9" },
  { id: "a9", blockId: "pb7", cat: "finishing", name: "acabamentos_acacia.pdf", size: 2200000, v: 2, by: "u9" },
  { id: "a10", blockId: "pb7", cat: "photos", name: "acacia_ambientada.jpg", size: 890000, v: 1, by: "u9" },
  { id: "a11", blockId: "pb7", cat: "videos", name: "acacia_360.mp4", size: 18000000, v: 1, by: "u9" },
  { id: "a12", blockId: "pb7", cat: "technical_drawing", name: "acacia_tecnico.pdf", size: 1100000, v: 1, by: "u9" },
  { id: "a13", blockId: "pb7", cat: "3d_block", name: "acacia_bloco.glb", size: 9500000, v: 1, by: "u9" },
  { id: "a14", blockId: "pb15", cat: "cad", name: "cadeira_capa.step", size: 3500000, v: 2, by: "u10" },
  { id: "a15", blockId: "pb15", cat: "finishing", name: "acabamentos_capa.pdf", size: 1200000, v: 1, by: "u10" },
  { id: "a16", blockId: "pb15", cat: "photos", name: "capa_foto_ref.jpg", size: 670000, v: 1, by: "u10" },
  { id: "a17", blockId: "pb15", cat: "technical_drawing", name: "capa_desenho.pdf", size: 900000, v: 1, by: "u10" },
  { id: "a18", blockId: "pb3", cat: "cad", name: "puff_umma.dwg", size: 1800000, v: 1, by: "u8" },
  { id: "a19", blockId: "pb3", cat: "photos", name: "umma_ref.jpg", size: 340000, v: 1, by: "u8" },
];

// Sem seed: o log de atividades só tem registros reais, gravados pelo servidor.
// Um log de exemplo aqui voltaria a poluir a tela de Atividade (regra: não inventar dados).
const ACTIVITIES: SeedActivity[] = [];

const PUBLICATIONS: SeedPub[] = [
  { id: "pub1", blockId: "pb1", url: "https://explorar.archtechtour.com/escal/ver-11/banco-nub/index.html", embed: '<iframe src="https://explorar.archtechtour.com/escal/ver-11/banco-nub/index.html" width="100%" height="600"></iframe>', env: "production", v: 11 },
  { id: "pub2", blockId: "pb5", url: "https://explorar.archtechtour.com/escal/ver-7/mesa-auxiliar-mary/index.html", embed: '<iframe src="https://explorar.archtechtour.com/escal/ver-7/mesa-auxiliar-mary/index.html" width="100%" height="600"></iframe>', env: "production", v: 7 },
  { id: "pub3", blockId: "pb8", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banco-piao/index.html", embed: '<iframe src="https://explorar.archtechtour.com/estudio-bola/ver-8/banco-piao/index.html" width="100%" height="600"></iframe>', env: "production", v: 8 },
  { id: "pub4", blockId: "pb9", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/poltrona-lala/index.html", embed: '<iframe src="https://explorar.archtechtour.com/estudio-bola/ver-8/poltrona-lala/index.html" width="100%" height="600"></iframe>', env: "production", v: 8 },
  { id: "pub5", blockId: "pb10", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banco-less/index.html", embed: '<iframe src="https://explorar.archtechtour.com/estudio-bola/ver-8/banco-less/index.html" width="100%" height="600"></iframe>', env: "production", v: 8 },
  { id: "pub6", blockId: "pb15", url: "https://explorar.archtechtour.com/wentz/ver-11/wentz-cadeira-capa/index.html", embed: '<iframe src="https://explorar.archtechtour.com/wentz/ver-11/wentz-cadeira-capa/index.html" width="100%" height="600"></iframe>', env: "production", v: 11 },
  { id: "pub7", blockId: "pb17", url: "https://explorar.archtechtour.com/minimal-design/ver-3/cabine-play-xp/index.html", embed: '<iframe src="https://explorar.archtechtour.com/minimal-design/ver-3/cabine-play-xp/index.html" width="100%" height="600"></iframe>', env: "production", v: 3 },
  // WJ — links corretos do Banco de Produtos (Notion), verificados em 2026-05-16
  { id: "pub8",  blockId: "pb21", url: "https://explorar.archtechtour.com/wj/ver-2/basal-parede/index.html",          embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-2/basal-parede/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',          env: "production", v: 2 },
  { id: "pub9",  blockId: "pb22", url: "https://explorar.archtechtour.com/wj/ver-2/canova-teto/index.html",           embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-2/canova-teto/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',           env: "production", v: 2 },
  { id: "pub10", blockId: "pb23", url: "https://explorar.archtechtour.com/wj/ver-3/cordel-parede/index.html",         embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-3/cordel-parede/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',         env: "production", v: 3 },
  { id: "pub11", blockId: "pb24", url: "https://explorar.archtechtour.com/wj/ver-5/cupulo/index.html",                embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-5/cupulo/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',                env: "production", v: 5 },
  { id: "pub12", blockId: "pb25", url: "https://explorar.archtechtour.com/wj/ver-3/doce-parede/index.html",           embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-3/doce-parede/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',           env: "production", v: 3 },
  { id: "pub13", blockId: "pb26", url: "https://explorar.archtechtour.com/wj/ver-3/dunas-linear-teto/index.html",     embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-3/dunas-linear-teto/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',     env: "production", v: 3 },
  { id: "pub14", blockId: "pb27", url: "https://explorar.archtechtour.com/wj/ver-7/enigma/index.html",                embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-7/enigma/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',                env: "production", v: 7 },
  { id: "pub15", blockId: "pb28", url: "https://explorar.archtechtour.com/wj/ver-3/facia-teto/index.html",            embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-3/facia-teto/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',            env: "production", v: 3 },
  { id: "pub16", blockId: "pb29", url: "https://explorar.archtechtour.com/wj/ver-3/ice-parede/index.html",            embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-3/ice-parede/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',            env: "production", v: 3 },
  { id: "pub17", blockId: "pb30", url: "https://explorar.archtechtour.com/wj/ver-2/imperial-teto/index.html",         embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-2/imperial-teto/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',         env: "production", v: 2 },
  { id: "pub18", blockId: "pb31", url: "https://explorar.archtechtour.com/wj/ver-3/mega-base-pedra-parede/index.html",embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-3/mega-base-pedra-parede/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',env: "production", v: 3 },
  { id: "pub19", blockId: "pb32", url: "https://explorar.archtechtour.com/wj/ver-2/mide-teto/index.html",             embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-2/mide-teto/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',             env: "production", v: 2 },
  { id: "pub20", blockId: "pb33", url: "https://explorar.archtechtour.com/wj/ver-3/ori-piso/index.html",              embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-3/ori-piso/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',              env: "production", v: 3 },
  { id: "pub21", blockId: "pb34", url: "https://explorar.archtechtour.com/wj/ver-2/samurai-piso/index.html",          embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-2/samurai-piso/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',          env: "production", v: 2 },
  { id: "pub22", blockId: "pb35", url: "https://explorar.archtechtour.com/wj/ver-2/samurai-teto/index.html",          embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-2/samurai-teto/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',          env: "production", v: 2 },
  { id: "pub23", blockId: "pb36", url: "https://explorar.archtechtour.com/wj/ver-2/solitario-cristal-teto/index.html",embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-2/solitario-cristal-teto/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',env: "production", v: 2 },
  { id: "pub24", blockId: "pb37", url: "https://explorar.archtechtour.com/wj/ver-4/umbra-parede/index.html",          embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-4/umbra-parede/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',          env: "production", v: 4 },
  { id: "pub25", blockId: "pb38", url: "https://explorar.archtechtour.com/wj/ver-5/vela-alt-4/index.html",            embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-5/vela-alt-4/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',            env: "production", v: 5 },
  { id: "pub26", blockId: "pb39", url: "https://explorar.archtechtour.com/wj/ver-4/vertice-teto/index.html",          embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-4/vertice-teto/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',          env: "production", v: 4 },
  { id: "pub27", blockId: "pb40", url: "https://explorar.archtechtour.com/wj/ver-7/enigma-vertical/index.html",       embed: '<iframe width="100%" height="640px" frameborder="0" src="https://explorar.archtechtour.com/wj/ver-7/enigma-vertical/index.html" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',       env: "production", v: 7 },
];

let BRANDS: Brand[] = [
  { clientId: "c1", companyName: "Escal Móveis", logoUrl: "", website: "www.escal.com.br", sector: "Móveis", priority: "high", step: 5 },
  { clientId: "c2", companyName: "Estúdio Bola", logoUrl: "", website: "www.estudiobola.com.br", sector: "Design de Interiores", priority: "normal", step: 5 },
  { clientId: "c3", companyName: "Wentz", logoUrl: "", website: "www.wentz.com.br", sector: "Móveis", priority: "high", step: 4 },
  { clientId: "c4", companyName: "Minimal Design", logoUrl: "", website: "www.minimaldesign.com.br", sector: "Mobiliário", priority: "normal", step: 2 },
  { clientId: "c5", companyName: "RS Design", logoUrl: "", website: "www.rsdesign.com.br", sector: "Design", priority: "low", step: 1 },
];

let CATALOG: CatalogProduct[] = [
  { id: "cp1", clientId: "c1", name: "Banco Nub", sku: "BANCO-NUB", category: "moveis", priority: 1, variations: [{ id: "v1", name: "Natural", finishes: "Tecido, Couro natural", colors: "Bege, Cinza, Preto", materials: "MDF, Espuma D28, Madeira Freixo" }] },
  { id: "cp2", clientId: "c1", name: "Banqueta Loai", sku: "BANQUETA-LOAI", category: "moveis", priority: 2, variations: [{ id: "v2", name: "Padrão", finishes: "Laminado, Couro PU", colors: "Caramelo, Off-white", materials: "Aço carbono, Couro PU" }] },
  { id: "cp3", clientId: "c1", name: "Puff Umma", sku: "PUFF-UMMA", category: "moveis", priority: 3, variations: [{ id: "v3", name: "Redondo", finishes: "Veludo, Bouclê", colors: "Verde musgo, Terracota, Nude", materials: "MDF naval, Espuma D33" }] },
  { id: "cp4", clientId: "c2", name: "Poltrona Acácia", sku: "POLTRONA-ACACIA", category: "moveis", priority: 1, variations: [{ id: "v4", name: "Acácia Classic", finishes: "Couro natural, Bouclê", colors: "Caramelo, Off-white, Grafite", materials: "Estrutura em aço, Espuma D45" }] },
  { id: "cp5", clientId: "c2", name: "Banco Pião", sku: "BANCO-PIAO", category: "moveis", priority: 2, variations: [{ id: "v5", name: "Giratório", finishes: "Madeira maciça envernizada", colors: "Freijó, Carvalho, Preto", materials: "Madeira maciça, Aço inox" }] },
];

let TICKETS: ProductionTicket[] = [
  { id: "tk1", clientId: "c1", blockId: "pb2", title: "Banqueta Loai – Programação 3D", plan: "plus", slaDate: "2026-05-10", priority: "high", assignedTo: "u5", status: "in_production" },
  { id: "tk2", clientId: "c1", blockId: "pb3", title: "Puff Umma – Modelagem", plan: "standard", slaDate: "2026-05-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk3", clientId: "c2", blockId: "pb7", title: "Poltrona Acácia – Revisão Interna", plan: "ultra", slaDate: "2026-04-28", priority: "high", assignedTo: "u3", status: "internal_review" },
  { id: "tk4", clientId: "c2", blockId: "pb11", title: "Cadeira Cota – Programação 3D", plan: "plus", slaDate: "2026-05-20", priority: "high", assignedTo: "u5", status: "in_production" },
  { id: "tk5", clientId: "c3", blockId: "pb16", title: "Poltrona Dama – Programação", plan: "ultra", slaDate: "2026-05-05", priority: "high", assignedTo: "u5", status: "in_production" },
  { id: "tk6", clientId: "c2", blockId: "pb13", title: "Sofá Block – Novo Ticket", plan: "ultra", slaDate: "2026-06-01", priority: "urgent", status: "new" },
  { id: "tk7", clientId: "c4", blockId: "pb18", title: "Cabine Play Pequena – Modelagem", plan: "standard", slaDate: "2026-05-25", priority: "normal", assignedTo: "u4", status: "in_production" },
];

// ============================================================
// MIGRATED DATA — Notion + Excel Planner (14 clientes, exceto WJ)
// Gerado em 2026-05-17 a partir de Notion Banco de Produtos
// + 155 tarefas reais do Excel. Substitui Notion/Planner como
// fonte de verdade.
// ============================================================
CONTRACTS = [...CONTRACTS, ...MIGRATED_CONTRACTS];
INITIAL_BLOCKS.push(...MIGRATED_BLOCKS);
PUBLICATIONS.push(...MIGRATED_PUBLICATIONS);
TICKETS = [...TICKETS, ...MIGRATED_TICKETS];

// Recalcula usedBlocks de cada contrato com base nos blocos REAIS
// (evita divergência entre contagem declarada e realidade do DB)
CONTRACTS = CONTRACTS.map((c) => ({
  ...c,
  usedBlocks: INITIAL_BLOCKS.filter((b) => b.contractId === c.id).length,
  totalBlocks: Math.max(c.totalBlocks, INITIAL_BLOCKS.filter((b) => b.contractId === c.id).length),
}));

// Remove publicações órfãs (referenciam blockId que não existe em INITIAL_BLOCKS)
const _blockIdSet = new Set(INITIAL_BLOCKS.map((b) => b.id));
const _validPubs = PUBLICATIONS.filter((p) => _blockIdSet.has(p.blockId));
PUBLICATIONS.length = 0;
PUBLICATIONS.push(..._validPubs);

// ============================================================
// HELPERS
// ============================================================
// Data sem hora ("2026-09-18") é lida como meia-noite UTC e, no Brasil, aparecia
// como o dia anterior. Ancorar ao meio-dia mantém o dia que foi digitado.
const fmtDate = (d: string | undefined) => d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR") : "—";
const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
const getUserName = (id: string) => USERS.find((u) => u.id === id)?.name || "—";
/** Nome de quem fez uma atividade: o registro carrega o nome (vale mesmo para usuário excluído). */
const actorName = (a: Pick<SeedActivity, "userId" | "userName">) => a.userName || getUserName(a.userId);
/**
 * Para onde uma atividade leva ao ser clicada (tela Atividade e feed do dashboard).
 * Devolve null quando não há destino (ex.: usuário excluído).
 */
interface ActivityNav { setPage: (p: string) => void; setSelectedBlock?: (id: string) => void; setSelectedContract?: (id: string) => void }
function activityTarget(a: SeedActivity, blocks: SeedBlock[], nav: ActivityNav): { label: string; go: () => void } | null {
  const block = a.blockId ? blocks.find((b) => b.id === a.blockId) : undefined;
  if (block && nav.setSelectedBlock) {
    const sel = nav.setSelectedBlock;
    return { label: `Abrir bloco ${block.sku}`, go: () => { sel(block.id); nav.setPage("block_detail"); } };
  }
  const entity = a.entity || "blocks";
  const simple = (label: string, page: string) => ({ label, go: () => nav.setPage(page) });
  switch (entity) {
    case "tickets": return simple("Abrir tickets", "tickets");
    case "clients": return simple("Abrir clientes", "clients");
    case "contracts":
      if (a.entityId && nav.setSelectedContract) { const sel = nav.setSelectedContract; const id = a.entityId; return { label: "Abrir contrato", go: () => { sel(id); nav.setPage("contract_detail"); } }; }
      return simple("Abrir contratos", "contracts");
    case "publications": return simple("Abrir publicações", "publications");
    case "users": return simple("Abrir usuários", "users");
    case "bim-demands": return simple("Abrir BIM · Terceirizados", "bim");
    case "finishes": return simple("Abrir acabamentos", "finishes");
    case "kb": return simple("Abrir Base de Conhecimento", "kb");
    case "agents": return simple("Abrir agente", a.entityId ? `agent_${a.entityId.replace(/-/g, "_")}` : "agents");
    case "analytics": return simple("Abrir analytics", "analytics");
    case "session": return a.type === "page_view" && a.page && a.page !== "block_detail" ? simple(`Abrir ${PAGE_LABELS[a.page] ?? a.page}`, a.page) : null;
    case "blocks": return a.type === "block_deleted" ? null : simple("Abrir blocos", "blocks");
    default: return null;
  }
}
const fmtDateTime = (d: string | undefined) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const getClientName = (id: string) => CLIENTS.find((c) => c.id === id)?.name || "—";
const getClientCode = (id: string) => CLIENTS.find((c) => c.id === id)?.code || "—";

// ------------------------------------------------------------
// Fontes de verdade derivadas (usadas por dashboard, sidebar, aprovações e contratos)
// ------------------------------------------------------------
// Não existe tabela de aprovações. "Aprovação pendente" É um bloco parado num
// status que espera o cliente — é o que o BlockDetail muda quando aprova.
// Derivar daqui garante que dashboard, badge da sidebar e tela de Aprovações
// mostrem o mesmo número, e que ele mude na hora que o status mudar.
const APPROVAL_STATUSES: readonly BlockStatus[] = ["awaiting_client_material_validation", "awaiting_client_final_validation"];
const isAwaitingClient = (b: SeedBlock) => APPROVAL_STATUSES.includes(b.status);
/** Próximo status quando o cliente aprova / status de volta quando pede revisão. */
const APPROVAL_NEXT: Partial<Record<BlockStatus, { approve: BlockStatus; reject: BlockStatus; label: string }>> = {
  awaiting_client_material_validation: { approve: "approved_for_programming", reject: "in_modeling", label: "Validação de Material" },
  awaiting_client_final_validation: { approve: "approved", reject: "internal_review", label: "Validação Final" },
};
const MAX_CLIENT_REVISIONS = 3;

// Blocos usados de um contrato = contagem REAL dos blocos, não o contador
// gravado em usedBlocks — ninguém atualiza esse contador quando um bloco é
// criado ou excluído, então ele descola da realidade no primeiro bloco novo.
const usedBlocksOf = (contractId: string, blocks: SeedBlock[]) => blocks.filter((b) => b.contractId === contractId).length;

// ------------------------------------------------------------
// Prazo do bloco e ticket acompanhando a etapa
// ------------------------------------------------------------
/**
 * Perfis de acesso vivos (padrões do código + o que veio de att-profiles). O
 * componente raiz atribui a cada render, ANTES de desenhar os filhos — por isso
 * `can()`/`special()` funcionam em qualquer função, sem hook.
 */
let PROFILES: AccessProfile[] = DEFAULT_PROFILES;
/** O usuário pode fazer `action` no módulo? (ver / criar / editar / excluir) */
const can = (u: SeedUser | null | undefined, moduleId: string, action: AccessAction) => !!u && canDo(u, PROFILES, moduleId, action);
const special = (u: SeedUser | null | undefined, perm: SpecialPerm) => !!u && hasSpecial(u, PROFILES, perm);

/** Prazo padrão de produção, em dias, contado da entrega dos materiais. */
const SLA_DAYS = 14;
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
/**
 * Quem pode mexer em datas (entrega do bloco, prazo do ticket): permissão especial
 * "Alterar prazos" do perfil de acesso. Por padrão toda a equipe interna tem
 * (liberado em 2026-09-18); cliente e terceirizado BIM não.
 */
const canEditDeadlines = (u: SeedUser) => special(u, "deadlines");
/** Só estas contas abrem a tela Atividade (auditoria de uso da equipe). */
const ACTIVITY_VIEWERS = ["mpalhano@archtechtour.com", "lliles@archtechtour.com"]; // Lucas Liles liberado em 2026-09-23
const canSeeActivity = (u: SeedUser) => ACTIVITY_VIEWERS.includes((u.email || "").toLowerCase());

/**
 * Aplica uma mudança de status ao bloco — ÚNICO lugar que decide os efeitos
 * colaterais: data de publicação e o relógio do prazo. O prazo conta da entrega
 * dos materiais: entrou em "Arquivos em Revisão" = materiais chegaram (e se o
 * cliente precisar reenviar, o relógio reinicia na nova entrega). Bloco que pula
 * direto para produção sem passar por lá ganha a data no dia em que entra.
 */
function withStatus(b: SeedBlock, status: BlockStatus, extra: Partial<SeedBlock> = {}): SeedBlock {
  const next: SeedBlock = { ...b, ...extra, status };
  if (status === "published" && !next.published) next.published = todayISO();
  const materialsArrived = status === "client_files_under_review" && b.status !== "client_files_under_review";
  // Só vale para quem está ENTRANDO em produção agora. Bloco antigo que já estava
  // em modelagem/texturização não ganha "materiais hoje" — o prazo dele é o que já
  // está no ticket (ou o que a PM digitar).
  const preProduction = ["draft", "awaiting_client_files", "client_files_under_review", "ready_to_start"].includes(b.status);
  const startedWithoutDate = !b.materialsAt && preProduction && (status === "ready_to_start" || status === "in_modeling" || status === "in_texturing");
  if (materialsArrived || startedWithoutDate) {
    next.materialsAt = todayISO();
    if (!next.dueManual) next.dueDate = addDaysISO(next.materialsAt, SLA_DAYS);
  }
  return next;
}

/** Etapa do bloco do jeito que aparece no ticket ("Modelagem", "Validação Material"…). */
const stageLabel = (status: BlockStatus) => PRODUCTION_PHASE_LABELS[status] ?? STATUS_LABELS[status] ?? status;
const ALL_STAGE_LABELS = () => Array.from(new Set([...Object.values(PRODUCTION_PHASE_LABELS), ...Object.values(STATUS_LABELS), "Novo Ticket"])) as string[];
/** Título automático = "<algo> – <etapa>". Título escrito à mão não é tocado. */
function retitle(title: string, b: SeedBlock): string {
  const i = title.lastIndexOf(" – ");
  if (i < 0 || !ALL_STAGE_LABELS().includes(title.slice(i + 3).trim())) return title;
  return `${b.title} – ${stageLabel(b.status)}`;
}
/**
 * Ticket aberto acompanha o bloco: etapa no título, situação e prazo. Antes o
 * título nascia "– Modelagem" e ficava assim para sempre, mesmo com o bloco já em
 * Validação de Material (Jéssica, 2026-09-18).
 */
function syncTicketsWithBlock(tickets: ProductionTicket[], b: SeedBlock): ProductionTicket[] {
  return tickets.map((t) => {
    if (t.blockId !== b.id || !isOpenTicket(t)) return t;
    let status: TicketStatus = t.status;
    if (b.status === "published") status = "delivered";
    else if (b.status === "internal_review") status = "internal_review";
    else if (PRODUCTION_PHASE_LABELS[b.status] && b.status !== "ready_to_start" && b.status !== "approved_for_programming" && t.status === "new") status = "in_production";
    else if (t.status === "internal_review") status = "in_production"; // bloco saiu da revisão interna
    const next = { ...t, title: retitle(t.title, b), status, slaDate: b.dueDate || t.slaDate };
    return next.title === t.title && next.status === t.status && next.slaDate === t.slaDate ? t : next;
  });
}
/**
 * Caminho inverso (Jéssica, 2026-09-23): mudar a situação do TICKET move o BLOCO.
 * Era preciso atualizar nos dois lugares. Regras:
 *  - "Em Produção" tira o bloco de "Pronto p/ Iniciar" / "Aprovado p/ Programação".
 *  - "Revisão Interna" leva o bloco em programação para Revisão Interna.
 *  - "Entregue" conclui a etapa: modelagem/texturização → Validação Material;
 *    programação/revisão → Validação Final; SketchUp → Conversão BIM; BIM → Publicado.
 * Devolve null quando o bloco não precisa mudar (ex.: já está adiante).
 */
function blockStatusForTicket(ticketStatus: TicketStatus, b: SeedBlock): BlockStatus | null {
  const s = b.status;
  if (ticketStatus === "in_production") {
    if (s === "ready_to_start") return "in_modeling";
    if (s === "approved_for_programming") return "in_programming";
    if (s === "internal_review") return "in_programming";
    return null;
  }
  if (ticketStatus === "internal_review") return s === "in_programming" || s === "approved_for_programming" ? "internal_review" : null;
  if (ticketStatus === "delivered") {
    if (s === "ready_to_start" || s === "in_modeling" || s === "in_texturing") return "awaiting_client_material_validation";
    if (s === "approved_for_programming" || s === "in_programming" || s === "internal_review") return "awaiting_client_final_validation";
    if (s === "sketchup_conversion") return "bim_conversion";
    if (s === "bim_conversion") return "published";
  }
  return null;
}
/** Ticket "aberto" = conta para fila, alertas e acompanha o bloco. Entregue ou arquivado, não. */
const isOpenTicket = (t: ProductionTicket) => t.status !== "delivered" && !t.archivedAt;
/**
 * Data de criação para ordenar "do mais recente". Ticket novo grava `createdAt`;
 * os criados pelo portal antes disso têm o instante no id (tk_<timestamp>); os
 * migrados do Planner (tk_c2_003…) não têm data nenhuma — usam a do bloco.
 */
function ticketCreatedAt(t: ProductionTicket, b?: SeedBlock): string {
  if (t.createdAt) return t.createdAt;
  const m = /^tk_(\d{12,})$/.exec(t.id);
  if (m) return new Date(Number(m[1])).toISOString();
  return b?.created ?? "";
}
/** Para a tela: ticket antigo com título congelado já aparece com a etapa de hoje. */
const ticketDisplayTitle = (t: ProductionTicket, b?: SeedBlock) => (b && isOpenTicket(t) ? retitle(t.title, b) : t.title);

function checkReadiness(blockId: string, serviceType: ServiceType, assets: SeedAsset[], finishesFilled = false) {
  const required = READINESS_RULES[serviceType] || [];
  const blockAssets = assets.filter((a) => a.blockId === blockId);
  const cats = new Set(blockAssets.map((a) => a.cat));
  // "Acabamento / Material" também fica ok quando o produto tem os acabamentos
  // cadastrados na aba Acabamentos — é o que a equipe usa para texturizar.
  if (finishesFilled) cats.add("finishing");
  const present = required.filter((c) => cats.has(c));
  const missing = required.filter((c) => !cats.has(c));
  const pct = required.length ? Math.round((present.length / required.length) * 100) : 100;
  return { complete: missing.length === 0, percentage: pct, required, present, missing };
}

// ============================================================
// CONTEXT
// ============================================================
interface AppState {
  currentUser: SeedUser | null;
  setCurrentUser: (u: SeedUser | null) => void;
  /** true depois que o estado veio do DynamoDB — antes disso a tela mostra seed. */
  hydrated: boolean;
  blocks: SeedBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<SeedBlock[]>>;
  activities: SeedActivity[];
  setActivities: React.Dispatch<React.SetStateAction<SeedActivity[]>>;
  assets: SeedAsset[];
  setAssets: React.Dispatch<React.SetStateAction<SeedAsset[]>>;
  tickets: ProductionTicket[];
  setTickets: React.Dispatch<React.SetStateAction<ProductionTicket[]>>;
  clients: SeedClient[];
  setClients: React.Dispatch<React.SetStateAction<SeedClient[]>>;
  contracts: SeedContract[];
  setContracts: React.Dispatch<React.SetStateAction<SeedContract[]>>;
  publications: SeedPub[];
  bimDemands: BimDemand[];
  setBimDemands: React.Dispatch<React.SetStateAction<BimDemand[]>>;
  finishes: FinishRecord[];
  setFinishes: React.Dispatch<React.SetStateAction<FinishRecord[]>>;
  setPublications: React.Dispatch<React.SetStateAction<SeedPub[]>>;
  users: SeedUser[];
  setUsers: React.Dispatch<React.SetStateAction<SeedUser[]>>;
  /** Base de Conhecimento: bases + artigos. Gravação por item (não passa pelo persist com debounce). */
  kb: KbRecord[];
  setKb: React.Dispatch<React.SetStateAction<KbRecord[]>>;
  kbError: string | null;
  /** Perfis de acesso: padrões do código + att-profiles (src/lib/access.ts). */
  profiles: AccessProfile[];
  setProfiles: React.Dispatch<React.SetStateAction<AccessProfile[]>>;
}
const AppContext = createContext<AppState>({} as AppState);

// ============================================================
// BASE UI COMPONENTS
// ============================================================
function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold leading-none tracking-[0.02em] ${className}`}>
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: BlockStatus }) {
  return <Badge className={STATUS_COLORS[status] || "border-slate-200 bg-slate-100 text-slate-600"}>{STATUS_LABELS[status] || status}</Badge>;
}

function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${PRIORITY_COLORS[priority]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function ServiceBadge({ type }: { type: ServiceType }) {
  return <Badge className={SERVICE_COLORS[type]}>{SERVICE_LABELS[type]}</Badge>;
}

function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[28px] border border-slate-200/70 bg-white/88 shadow-[0_18px_54px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl ${onClick ? "cursor-pointer transition duration-300 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_26px_70px_-34px_rgba(15,23,42,0.55)]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = "text-slate-900", onClick }: {
  icon: any; label: string; value: number | string; sub?: string; color?: string; onClick?: () => void;
}) {
  return (
    <Card className="relative overflow-hidden p-5 md:p-6" onClick={onClick}>
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className={`mt-4 text-[1.85rem] font-semibold tracking-tight ${color}`}>{value}</p>
          {sub && <p className="mt-2 text-sm leading-6 text-slate-500">{sub}</p>}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-950 text-white shadow-[0_20px_34px_-26px_rgba(15,23,42,0.9)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const color = value === 100 ? "from-emerald-400 to-emerald-500" : value >= 60 ? "from-cyan-400 to-blue-500" : "from-amber-300 to-amber-500";
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 ${className}`}>
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

// ============================================================
// PERMISSÕES DE PÁGINA (só para clientes)
// ============================================================

/**
 * Padrão de acesso do cliente enquanto o portal está em validação: só Analytics.
 *
 * É o PADRÃO, aplicado a quem não tem `allowedPages` — assim um cliente
 * cadastrado hoje já nasce restrito, sem depender de alguém lembrar de marcar
 * as páginas. Para liberar todo mundo depois da validação, troque esta linha
 * por `["all"]`. Para exceções, marque as páginas no próprio usuário (a
 * marcação do usuário vence este padrão).
 */
const PAGINAS_PADRAO_CLIENTE = ["analytics"];

/** Páginas liberáveis para cliente, na ordem do menu. */
const PAGINAS_CLIENTE: Array<{ id: string; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "onboarding", label: "Onboarding" },
  { id: "blocks", label: "Meus Blocos" },
  { id: "finishes", label: "Acabamentos" },
  { id: "approvals", label: "Aprovações" },
  { id: "publications", label: "Publicações" },
  { id: "analytics", label: "Analytics" },
  { id: "contracts", label: "Contratos" },
];

/** Telas de detalhe herdam a permissão da listagem que as abre. */
const PAGINA_PAI: Record<string, string> = {
  block_detail: "blocks",
  contract_detail: "contracts",
  agent_sherlock_codes: "agents", agent_monk_lighthouse: "agents", agent_yoda_kanban: "agents",
  agent_harvey_closer: "agents", agent_argus_watchtower: "agents",
};

/**
 * Módulos que o usuário abre = os marcados como "Ver" no PERFIL DE ACESSO dele
 * (src/lib/access.ts). Para cliente, "Telas liberadas" no cadastro do usuário
 * vence o perfil (exceção caso a caso, como já era antes dos perfis).
 */
function paginasPermitidas(user: SeedUser): string[] {
  if (user.role === "client") {
    const cfg = user.allowedPages;
    if (cfg?.includes("all")) return ACCESS_MODULES.filter((m) => m.audiences.includes("client")).map((m) => m.id);
    if (cfg && cfg.length > 0) return cfg;
  }
  const prof = profileOf(user, PROFILES);
  return ACCESS_MODULES.filter((m) => prof.modules?.[m.id]?.view).map((m) => m.id);
}

/**
 * Trava de navegação. Tem que ser checada no renderPage, não só no menu: o
 * dashboard do cliente tem botões que chamam setPage("blocks"/"contracts")
 * direto, então esconder o item do menu não impediria de chegar na tela.
 */
function podeAcessar(user: SeedUser, page: string): boolean {
  // Base de Conhecimento: a trava é POR BASE (perfis/usuários liberados em cada
  // uma), dentro da própria tela. Quem não tem base liberada vê a tela vazia e
  // nem enxerga o item no menu (Sidebar filtra por temBaseLiberada).
  if (page === "kb") return true;
  // Atividade é auditoria de uso da equipe: só o dono do portal enxerga.
  if (page === "activity") return canSeeActivity(user);
  return paginasPermitidas(user).includes(PAGINA_PAI[page] ?? page);
}

/** Primeira página que o usuário pode abrir — é onde ele cai ao logar. */
function primeiraPaginaPermitida(user: SeedUser): string {
  const permitidas = paginasPermitidas(user);
  if (permitidas.includes("dashboard")) return "dashboard";
  // Sem nenhum módulo no perfil: a Base de Conhecimento é a única tela que não depende dele.
  return permitidas[0] ?? "kb";
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] border border-slate-200/80 bg-slate-50/90 shadow-inner shadow-white">
        <Icon className="h-7 w-7 text-slate-300" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {desc && <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{desc}</p>}
    </div>
  );
}

function TabBtn({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.75)]" : "border-slate-200/80 bg-white/70 text-slate-500 hover:border-slate-300/90 hover:text-slate-700"}`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-500"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function DataTable({ columns, data, onRowClick }: { columns: any[]; data: any[]; onRowClick?: (row: any) => void }) {
  if (!data.length) return <EmptyState icon={Clipboard} title="Nenhum registro encontrado" desc="Tente ajustar os filtros ou criar um novo item." />;
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/75">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50/85 backdrop-blur">
            <tr>
              {columns.map((col: any, i: number) => (
                <th key={i} className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, ri: number) => (
              <tr key={ri} onClick={() => onRowClick?.(row)} className={`group border-t border-slate-100/90 ${onRowClick ? "cursor-pointer hover:bg-slate-50/80" : ""} transition-colors`}>
                {columns.map((col: any, ci: number) => (
                  <td key={ci} className="px-5 py-4 align-top text-sm text-slate-600">{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.25rem]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ============================================================
// SESSÃO NO NAVEGADOR (sobrevive ao F5)
// ============================================================
// Antes, recarregar a página zerava o estado em memória: quem entrou por
// e-mail/senha voltava para a tela de login, e quem entrou pelo Microsoft
// reentrava no dashboard (perdendo a tela onde estava) e gerava um "login"
// novo no log a cada F5. Guardamos quem está logado (sem senha) e a tela atual.
const SESSION_KEY = "att_session";
const PAGE_KEY = "att_page";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type StoredSession = { user: Omit<SeedUser, "password">; at: number };
const readSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY); if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s?.user?.id || Date.now() - (s.at || 0) > SESSION_TTL_MS) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
};
const saveSession = (u: SeedUser) => { try { const { password: _pw, ...user } = u; localStorage.setItem(SESSION_KEY, JSON.stringify({ user, at: Date.now() } satisfies StoredSession)); } catch { /* sem storage */ } };
const clearSession = () => { try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(PAGE_KEY); } catch { /* sem storage */ } };
const readPage = (): string | null => { try { return localStorage.getItem(PAGE_KEY); } catch { return null; } };
const savePage = (page: string) => { try { localStorage.setItem(PAGE_KEY, page); } catch { /* sem storage */ } };

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage() {
  const { setCurrentUser } = useContext(AppContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  // O NextAuth pode reentregar a mesma sessão (refetch); o "login" vai ao log uma vez por e-mail.
  const loginLogged = useRef<string | null>(null);

  // Auto-login when Microsoft SSO session arrives
  useEffect(() => {
    if (!session?.user?.email) return;
    const msEmail = (session.user.email as string).toLowerCase();
    const logLogin = (who: SeedUser, how: string) => {
      if (loginLogged.current === msEmail) return;
      loginLogged.current = msEmail;
      // F5 com sessão guardada não é um login novo — só restauração.
      if (readSession()?.user.email?.toLowerCase() === msEmail) return;
      logActivity({ type: "login", entity: "session", desc: how }, { id: who.id, name: who.name, role: who.role, email: who.email, clientId: who.clientId });
    };
    // Match against seed users by email
    const user = USERS.find((u) => u.email.toLowerCase() === msEmail);
    if (user) {
      setCurrentUser(user);
      logLogin(user, "Entrou no portal (conta Microsoft)");
    } else {
      // Auto-create a temporary session for any @archtechtour.com Microsoft user.
      // O id é derivado do e-mail (estável): assim o log de atividades agrupa
      // as ações da pessoa entre sessões, mesmo sem cadastro em Usuários.
      if (msEmail.endsWith("@archtechtour.com")) {
        const temp: SeedUser = {
          id: `ms_${msEmail.replace(/[^a-z0-9]+/g, "_")}`,
          email: msEmail,
          password: "",
          name: (session.user.name as string | null | undefined) ?? msEmail,
          role: "admin",
          active: true,
        };
        setCurrentUser(temp);
        logLogin(temp, "Entrou no portal (conta Microsoft, sem cadastro em Usuários)");
      } else {
        setError("Conta Microsoft não autorizada para este portal.");
      }
    }
  }, [session, setCurrentUser]);

  const handleLogin = () => {
    setError("");
    setLoading(true);
    setTimeout(() => {
      // Check seed users first
      let user: SeedUser | undefined = USERS.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
      );
      // If not found, check users registered via /contrato flow (stored in localStorage)
      if (!user) {
        try {
          const stored = localStorage.getItem("att_portal_users");
          if (stored) {
            const registeredUsers: SeedUser[] = JSON.parse(stored);
            user = registeredUsers.find(
              (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
            );
          }
        } catch {
          // ignore parse errors
        }
      }
      if (user) {
        setCurrentUser(user);
        logActivity({ type: "login", entity: "session", desc: "Entrou no portal (e-mail e senha)" }, { id: user.id, name: user.name, role: user.role, email: user.email, clientId: user.clientId });
      } else {
        setError("E-mail ou senha incorretos. Tente novamente.");
      }
      setLoading(false);
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-[#07111f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-emerald-500/8 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-xl shadow-emerald-500/25">
              <Box className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-xl font-bold text-white tracking-tight">ArchTechTour</p>
              <p className="text-slate-400 text-sm mt-0.5">Portal de Operações</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
          <h2 className="text-base font-semibold text-white mb-5">Entrar na sua conta</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="seu@email.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-400/50 focus:bg-slate-700 transition-all"
                style={{ WebkitTextFillColor: "white" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-white/10 bg-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-400/50 focus:bg-slate-700 transition-all"
                  style={{ WebkitTextFillColor: "white" }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-400/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={!email.trim() || !password || loading}
            className="w-full mt-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-slate-900 text-sm font-bold disabled:opacity-30 hover:brightness-110 transition-all shadow-lg shadow-emerald-500/20"
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-slate-500">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={() => signIn("azure-ad", { callbackUrl: "/portal" })}
            className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2.5 text-sm font-semibold text-white"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Entrar com Microsoft
          </button>

          <p className="text-xs text-slate-500 text-center mt-4">
            Problemas para acessar? Entre em contato com{" "}
            <span className="text-slate-400">info@archtechtour.com</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
function Sidebar({ page, setPage, user, collapsed, setCollapsed }: {
  page: string; setPage: (p: string) => void; user: SeedUser; collapsed: boolean; setCollapsed: (c: boolean) => void;
}) {
  const { blocks } = useContext(AppContext);
  const isClient = user.role === "client";
  const pendingApprovals = blocks.filter((b) => isAwaitingClient(b) && (!isClient || b.clientId === user.clientId)).length;

  const isFreelancer = user.role === "freelancer_bim";
  const { kb } = useContext(AppContext);
  // Item "Base de Conhecimento" só aparece para quem tem ao menos uma base liberada (admin sempre).
  const temBaseLiberada = user.role === "admin" || kb.some((r) => isKbBase(r) && canViewBase(r as KbBase, user));
  const itemKb: Array<{ id: string; icon: any; label: string; badge?: number }> = temBaseLiberada ? [{ id: "kb", icon: BookOpen, label: "Base de Conhecimento" }] : [];
  const todosItens = isFreelancer
    ? [{ id: "bim_minhas", icon: Box, label: "Minhas demandas" }, ...itemKb]
    : isClient
    ? [
        { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { id: "onboarding", icon: Clipboard, label: "Onboarding" },
        { id: "blocks", icon: Package, label: "Meus Blocos" },
        { id: "approvals", icon: CheckCircle, label: "Aprovações", badge: pendingApprovals },
        { id: "publications", icon: Globe, label: "Publicações" },
        { id: "finishes", icon: Filter, label: "Acabamentos" },
        { id: "analytics", icon: BarChart3, label: "Analytics" },
        { id: "contracts", icon: FileText, label: "Contratos" },
        ...itemKb,
      ]
    : [
        { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { id: "tickets", icon: Hash, label: "Tickets" },
        { id: "bim", icon: Box, label: "BIM · Terceirizados" },
        { id: "queue", icon: Layers, label: "Fila de Trabalho" },
        { id: "blocks", icon: Package, label: "Todos os Blocos" },
        { id: "approvals", icon: CheckCircle, label: "Aprovações", badge: pendingApprovals },
        { id: "publications", icon: Globe, label: "Publicações" },
        { id: "finishes", icon: Filter, label: "Acabamentos" },
        { id: "analytics", icon: BarChart3, label: "Analytics" },
        { id: "clients", icon: Users, label: "Clientes" },
        { id: "contracts", icon: FileText, label: "Contratos" },
        { id: "activity", icon: Activity, label: "Atividade" },
        { id: "users", icon: Settings, label: "Usuários" },
        { id: "profiles", icon: Lock, label: "Perfis de acesso" },
        ...itemKb,
        { id: "agents", icon: Sparkles, label: "Agentes AI" }, // quem vê sai do perfil de acesso (podeAcessar)
      ];

  // Esconder o item aqui é só o efeito visual — quem realmente barra o acesso é
  // o podeAcessar() no renderPage.
  const navItems = todosItens.filter((item) => podeAcessar(user, item.id));

  const workspaceLabel = isFreelancer ? "Terceirizado BIM" : isClient ? getClientName(user.clientId!) : "Operação Interna";

  return (
    <aside className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-slate-800/60 backdrop-blur-xl transition-all duration-300 ${collapsed ? "w-[88px]" : "w-[280px]"}`} style={{ backgroundColor: "rgba(7,17,31,0.97)", color: "white" }}>
      <div className="flex-shrink-0 p-4 pb-3">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.9)]">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-sky-500 shadow-[0_12px_30px_-12px_rgba(34,211,238,0.55)]">
              <Box className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">ArchTechTour</p>
                <p className="mt-1 text-sm font-semibold text-white">Portal premium</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{workspaceLabel}</p>
              </div>
            )}
            <button onClick={() => setCollapsed(!collapsed)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white">
              {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {!collapsed && <p className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Navegação</p>}

      {/* min-h-0 + overflow-y-auto: sem isso o flex-1 não encolhe e os itens de
          baixo ficam cortados quando o menu não cabe na altura da tela. */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
        {navItems.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`group relative flex w-full items-center gap-3 rounded-[20px] px-3.5 py-3 text-sm transition ${active ? "bg-white text-slate-950 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.75)]" : "text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"}`}
            >
              {active && !collapsed && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 to-emerald-400" />}
              <item.icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? "text-slate-950" : "text-slate-500 group-hover:text-slate-100"}`} />
              {!collapsed && <span className="flex-1 text-left font-semibold">{item.label}</span>}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-rose-100 text-rose-600" : "bg-rose-500/15 text-rose-300"}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex-shrink-0 p-4 pt-3">
        <div className={`rounded-[24px] border border-white/10 bg-white/5 p-3 ${collapsed ? "flex justify-center" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-white">
              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">{ROLE_LABELS[user.role]}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// DASHBOARD INTERNO
// ============================================================
function InternalDashboard({ setPage, openBlocks, setSelectedBlock, setSelectedContract }: { setPage: (p: string) => void; openBlocks: (status: BlockStatus | "all") => void; setSelectedBlock: (id: string) => void; setSelectedContract: (id: string) => void }) {
  // Tudo aqui sai do estado vivo do app (hidratado do DynamoDB e atualizado
  // por qualquer tela). Nada de constantes de seed: elas congelam o número.
  const { blocks, activities, clients, hydrated, bimDemands } = useContext(AppContext);
  const bimOpen = bimDemands.filter(bimIsOpen);
  const bimOpenProducts = bimOpen.reduce((n, d) => n + d.productCount, 0);
  const bimLate = bimOpen.filter((d) => bimDaysLeft(d) < 0).length;
  const byStatus: Record<string, number> = {};
  blocks.forEach((b) => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });
  const pending = blocks.filter(isAwaitingClient).length;
  const recent = activities.filter((a) => !isNavigation(a)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const activeClients = clients.map((client) => ({
    ...client,
    count: blocks.filter((b) => b.clientId === client.id).length,
  })).filter((client) => client.count > 0).sort((a, b) => b.count - a.count);

  // Esteira completa, na ordem das transições — antes faltavam 4 estágios
  // (rascunho, arquivos em revisão, aprovado p/ programação, aguardando
  // material), então um bloco recém-criado simplesmente não aparecia aqui.
  const pipeline: { s: BlockStatus; icon: any; color: string }[] = [
    { s: "draft", icon: FileText, color: "text-slate-400" },
    { s: "awaiting_client_files", icon: Clock, color: "text-amber-500" },
    { s: "client_files_under_review", icon: Search, color: "text-sky-500" },
    { s: "ready_to_start", icon: Play, color: "text-emerald-500" },
    { s: "in_modeling", icon: Layers, color: "text-violet-500" },
    { s: "in_texturing", icon: Sparkles, color: "text-pink-500" },
    { s: "awaiting_client_material_validation", icon: UserCheck, color: "text-amber-500" },
    { s: "approved_for_programming", icon: ThumbsUp, color: "text-emerald-500" },
    { s: "in_programming", icon: Zap, color: "text-indigo-500" },
    { s: "internal_review", icon: Eye, color: "text-fuchsia-500" },
    { s: "awaiting_client_final_validation", icon: UserCheck, color: "text-amber-500" },
    { s: "approved", icon: ThumbsUp, color: "text-emerald-600" },
    { s: "sketchup_conversion", icon: Box, color: "text-orange-500" },
    { s: "bim_conversion", icon: Box, color: "text-teal-600" },
    { s: "published", icon: Globe, color: "text-emerald-600" },
  ];
  const onPipeline = pipeline.reduce((n, p) => n + (byStatus[p.s] || 0), 0);
  const paused = (byStatus["blocked"] || 0) + (byStatus["on_hold"] || 0) + (byStatus["archived"] || 0);
  const inProduction = ["ready_to_start", "in_modeling", "in_texturing", "approved_for_programming", "in_programming", "internal_review", "sketchup_conversion", "bim_conversion"].reduce((n, st) => n + (byStatus[st] || 0), 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Painel interno"
        title="Pipeline digital com mais clareza"
        description="Uma leitura mais sofisticada do fluxo operacional, aproximando o portal da linguagem de produto e tecnologia da ArchTechTour."
        action={<Badge className="border-slate-200/80 bg-white/80 text-slate-600">{blocks.length} blocos monitorados</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="relative overflow-hidden border-slate-950/70 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_rgba(6,17,29,1)_44%,_rgba(6,17,29,1)_100%)] p-6 text-white md:p-8">
          <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.62)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.62)_1px,transparent_1px)] [background-size:52px_52px]" />
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/10 bg-white/8 text-slate-100">Operações ArchTechTour</Badge>
              {hydrated
                ? <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">Sincronizado com o banco</Badge>
                : <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200">Carregando dados…</Badge>}
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-[2.25rem]">
              {pending > 0 || (byStatus["blocked"] || 0) > 0
                ? `${pending} aguardando o cliente · ${byStatus["blocked"] || 0} bloqueado${(byStatus["blocked"] || 0) === 1 ? "" : "s"} · ${inProduction} em produção.`
                : `Nada travado. ${inProduction} bloco${inProduction === 1 ? "" : "s"} em produção agora.`}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Números lidos do estado atual do portal — mudam na hora que um bloco muda de status em qualquer tela.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total de blocos", value: blocks.length, sub: "Base monitorada", onClick: () => openBlocks("all") },
                { label: "Bloqueados", value: byStatus["blocked"] || 0, sub: "Pedem atenção", onClick: () => openBlocks("blocked") },
                { label: "Aprovações", value: pending, sub: "Aguardando o cliente", onClick: () => setPage("approvals") },
                { label: "Publicados", value: byStatus["published"] || 0, sub: "Ao vivo", onClick: () => openBlocks("published") },
              ].map((item) => (
                <button key={item.label} onClick={item.onClick} className="rounded-[22px] border border-white/10 bg-white/6 p-4 text-left backdrop-blur transition hover:bg-white/10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Atalhos</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Ações mais importantes</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-950 text-white">
                <ChevronRight className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: "Fila de trabalho", desc: "Distribua e acompanhe responsáveis", onClick: () => setPage("queue") },
                { label: "Aprovações pendentes", desc: "Validações aguardando ação", onClick: () => setPage("approvals") },
                { label: "Todos os blocos", desc: "Faça leituras mais amplas da operação", onClick: () => setPage("blocks") },
              ].map((item) => (
                <button key={item.label} onClick={item.onClick} className="flex w-full items-center justify-between rounded-[22px] border border-slate-200/80 bg-slate-50/70 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-100/80">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </Card>

          <MetricCard
            icon={AlertTriangle}
            label="Bloqueios"
            value={byStatus["blocked"] || 0}
            sub="Itens que precisam de destravamento operacional ou retorno do cliente."
            color="text-rose-600"
            onClick={() => openBlocks("blocked")}
          />
          <MetricCard
            icon={Box}
            label="BIM com terceirizados"
            value={bimOpenProducts}
            sub={bimOpen.length === 0 ? "Nenhuma demanda aberta." : `${bimOpen.length} demanda${bimOpen.length === 1 ? "" : "s"} aberta${bimOpen.length === 1 ? "" : "s"}${bimLate ? ` · ${bimLate} atrasada${bimLate === 1 ? "" : "s"}` : ""}`}
            color={bimLate ? "text-rose-600" : "text-sky-700"}
            onClick={() => setPage("bim")}
          />
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Pipeline</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Produção em andamento</h3>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-500">Todos os estágios, na ordem do fluxo. Clique num estágio para abrir só os blocos que estão nele.</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pipeline.map(({ s, icon: Icon, color }) => (
            <button key={s} onClick={() => openBlocks(s)} className="group rounded-[24px] border border-slate-200/80 bg-white/75 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{STATUS_LABELS[s]}</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{byStatus[s] || 0}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                <span>Ver blocos</span>
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 pt-4 text-sm text-slate-500">
          <span><span className="font-semibold text-slate-700">{onPipeline}</span> na esteira</span>
          <button onClick={() => openBlocks("blocked")} className="hover:text-slate-700"><span className="font-semibold text-rose-600">{byStatus["blocked"] || 0}</span> bloqueados</button>
          <button onClick={() => openBlocks("on_hold")} className="hover:text-slate-700"><span className="font-semibold text-slate-700">{byStatus["on_hold"] || 0}</span> em espera</button>
          <button onClick={() => openBlocks("archived")} className="hover:text-slate-700"><span className="font-semibold text-slate-700">{byStatus["archived"] || 0}</span> arquivados</button>
          <span className="ml-auto text-xs text-slate-400">{onPipeline + paused} = {blocks.length} blocos</span>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Clientes ativos</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Carga por marca</h3>
            </div>
            <Badge className="border-slate-200/80 bg-slate-50 text-slate-600">{activeClients.length} contas</Badge>
          </div>
          <div className="mt-6 space-y-4">
            {activeClients.map((client) => {
              const pct = blocks.length ? Math.round((client.count / blocks.length) * 100) : 0;
              return (
                <div key={client.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xs font-semibold text-slate-600 shadow-sm">
                        {client.code.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{client.name}</p>
                        <p className="text-xs text-slate-400">{client.count} blocos no pipeline</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{pct}%</p>
                  </div>
                  <ProgressBar value={pct} className="mt-4" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Atividade recente</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Movimentações da operação</h3>
            </div>
            <button onClick={() => setPage("activity")} className="text-sm font-semibold text-cyan-700 transition hover:text-cyan-800">Ver tudo</button>
          </div>
          <div className="mt-6 space-y-3">
            {recent.length === 0 && <p className="text-sm text-slate-400">Nenhuma movimentação registrada ainda.</p>}
            {recent.map((act) => {
              const block = blocks.find((b) => b.id === act.blockId);
              const target = activityTarget(act, blocks, { setPage, setSelectedBlock, setSelectedContract });
              return (
                <div key={act.id} onClick={target?.go} title={target?.label} className={`rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4 transition ${target ? "cursor-pointer hover:border-cyan-300 hover:bg-white" : ""}`}>
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Activity className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{act.desc}</p>
                      <p className="mt-1 text-sm text-slate-500">{actorName(act)}</p>
                      <p className="mt-2 text-xs text-slate-400">{block?.sku ? `${block.sku} · ` : ""}{fmtDateTime(act.at)}{target && <span className="ml-2 font-semibold text-cyan-700">{target.label} →</span>}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD CLIENTE
// ============================================================
function ClientDashboard({ user, setPage, setSelectedBlock }: { user: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void }) {
  const { blocks, contracts, publications } = useContext(AppContext);
  const cid = user.clientId!;
  const ctrs = contracts.filter((c) => c.clientId === cid);
  const contracted = ctrs.reduce((s, c) => s + c.totalBlocks, 0);
  // Contagem real dos blocos do contrato — o contador gravado não acompanha
  // criação/exclusão, então "disponíveis" ficava errado no primeiro bloco novo.
  const used = ctrs.reduce((s, c) => s + usedBlocksOf(c.id, blocks), 0);
  const myBlocks = blocks.filter((b) => b.clientId === cid);
  const awaiting = myBlocks.filter((b) => ["awaiting_client_files", "awaiting_client_material_validation", "awaiting_client_final_validation"].includes(b.status)).length;
  const inProduction = myBlocks.filter((b) => ["ready_to_start", "in_modeling", "in_texturing", "approved_for_programming", "in_programming", "internal_review", "sketchup_conversion", "bim_conversion"].includes(b.status)).length;
  const publishedCount = myBlocks.filter((b) => b.status === "published").length;
  const contractUsage = contracted ? Math.round((used / contracted) * 100) : 0;
  const latestContract = [...ctrs].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const nextActions = myBlocks.filter((b) => ["awaiting_client_files", "awaiting_client_material_validation", "awaiting_client_final_validation"].includes(b.status)).slice(0, 3);
  const liveBlocks = myBlocks.filter((b) => b.status === "published").slice(0, 3);
  const isNewClient = myBlocks.length === 0;

  // Onboarding steps — step 0 is always done (contract signed)
  const onboardingSteps = [
    { label: "Contrato assinado", done: true, desc: "Seu contrato está ativo e registrado." },
    { label: "Reunião de onboarding agendada", done: !isNewClient, desc: "A equipe ATT entrará em contato em até 5 dias úteis para agendar." },
    { label: "Envio dos arquivos", done: myBlocks.some((b) => !["awaiting_client_files"].includes(b.status)), desc: "Envie blocos 3D, fotos, logo e desenhos técnicos para info@archtechtour.com." },
    { label: "Aprovação do produto-modelo", done: myBlocks.some((b) => ["approved_for_programming", "in_programming", "internal_review", "awaiting_client_final_validation", "approved", "sketchup_conversion", "bim_conversion", "published"].includes(b.status)), desc: "Validaremos 10% dos produtos como amostra antes de produzir o restante." },
    { label: "Publicação no catálogo digital", done: publishedCount > 0, desc: "Seus blocos estarão disponíveis em 3D e RA na plataforma ArchTechTour." },
  ];
  const onboardingProgress = onboardingSteps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Portal do cliente"
        title={`Olá, ${user.name.split(" ")[0]}. Bem-vindo ao seu portal.`}
        description={isNewClient
          ? "Seu contrato está ativo. Acompanhe abaixo os próximos passos para iniciar a produção dos seus blocos 3D."
          : `Acompanhe o andamento dos seus blocos 3D, aprovações e publicações na plataforma ArchTechTour.`}
        action={<Badge className="border-slate-200/80 bg-white/80 text-slate-600">{getClientName(cid)}</Badge>}
      />

      {/* ONBOARDING BANNER — shown while not all steps done */}
      {onboardingProgress < onboardingSteps.length && (
        <Card className="relative overflow-hidden border-cyan-200/60 bg-[linear-gradient(135deg,rgba(236,254,255,0.98),rgba(240,253,250,0.98))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Onboarding</p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">
                {onboardingProgress === 1 ? "Vamos começar — siga os próximos passos" : `${onboardingProgress} de ${onboardingSteps.length} etapas concluídas`}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-40 rounded-full bg-slate-200/80 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-all" style={{ width: `${(onboardingProgress / onboardingSteps.length) * 100}%` }} />
              </div>
              <span className="text-sm font-semibold text-slate-500">{Math.round((onboardingProgress / onboardingSteps.length) * 100)}%</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {onboardingSteps.map((step, i) => (
              <div key={i} className={`rounded-[20px] border p-4 ${step.done ? "border-emerald-200/80 bg-emerald-50/80" : i === onboardingProgress ? "border-cyan-300/60 bg-white shadow-sm" : "border-slate-200/60 bg-white/60"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${step.done ? "bg-emerald-500 text-white" : i === onboardingProgress ? "bg-cyan-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {step.done ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <p className={`text-xs font-semibold ${step.done ? "text-emerald-700" : i === onboardingProgress ? "text-cyan-800" : "text-slate-400"}`}>{step.label}</p>
                </div>
                <p className="text-xs text-slate-500 leading-5">{step.desc}</p>
                {i === onboardingProgress && i === 2 && (
                  <button onClick={() => setPage("blocks")} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700">
                    <FileUp className="h-3 w-3" /> Enviar materiais
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* STATS + CONTRACT */}
      <div className="grid gap-4 xl:grid-cols-[1.28fr_0.92fr]">
        <Card className="relative overflow-hidden border-slate-950/70 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_rgba(6,17,29,1)_48%,_rgba(6,17,29,1)_100%)] p-6 text-white md:p-8">
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.62)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.62)_1px,transparent_1px)] [background-size:52px_52px]" />
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/10 bg-white/8 text-slate-100">{latestContract?.title || "Contrato ativo"}</Badge>
              {awaiting > 0 && <Badge className="border-amber-400/20 bg-amber-400/15 text-amber-200">{awaiting} {awaiting === 1 ? "item pede" : "itens pedem"} sua atenção</Badge>}
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-[2.1rem]">
              {isNewClient ? "Seus produtos em 3D e RA começam aqui." : `${publishedCount > 0 ? `${publishedCount} bloco${publishedCount > 1 ? "s" : ""} publicado${publishedCount > 1 ? "s" : ""}.` : "Produção em andamento."} Acompanhe tudo em tempo real.`}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              {isNewClient
                ? "Assim que você enviar os arquivos dos seus produtos, a equipe ArchTechTour inicia a digitalização em 3D. Você acompanha cada etapa aqui, com aprovações e publicação ao vivo."
                : "Cada bloco passa por modelagem, aprovação e publicação. Você recebe notificação a cada etapa que precisar da sua validação."}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Blocos contratados", value: contracted, sub: `${contracted - used} disponíveis` },
                { label: "Em produção", value: inProduction, sub: "sendo trabalhados agora" },
                { label: "Publicados", value: publishedCount, sub: "ao vivo na plataforma" },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] border border-white/10 bg-white/6 p-4 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.sub}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => setPage("blocks")} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                <FileUp className="h-4 w-4" />
                {isNewClient ? "Enviar meus arquivos" : "Ver meus blocos"}
              </button>
              <button onClick={() => setPage("contracts")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                <FileText className="h-4 w-4" />
                Meu contrato
              </button>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Contrato ativo</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{latestContract?.title || "Contrato ArchTechTour"}</h3>
                <p className="mt-1.5 text-sm text-slate-500">Início em {latestContract ? fmtDate(latestContract.startDate) : "—"}</p>
              </div>
              <Badge className="border-slate-200/80 bg-slate-50 text-slate-600">{contractUsage}% usado</Badge>
            </div>
            <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                <span>Uso do contrato</span>
                <span>{used} de {contracted} blocos</span>
              </div>
              <ProgressBar value={contractUsage} className="mt-4" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Disponíveis</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600">{contracted - used}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Em produção</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{inProduction}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Pendências</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                  {awaiting > 0 ? `${awaiting} item${awaiting > 1 ? "ns" : ""} aguardando você` : "Nenhuma ação pendente"}
                </h3>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-white ${awaiting > 0 ? "border-amber-200 bg-amber-500" : "border-slate-200/80 bg-slate-100"}`}>
                <AlertTriangle className={`h-5 w-5 ${awaiting > 0 ? "text-white" : "text-slate-400"}`} />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {nextActions.length ? nextActions.map((block) => (
                <button key={block.id} onClick={() => { setSelectedBlock(block.id); setPage("block_detail"); }} className="flex w-full items-center justify-between rounded-[22px] border border-amber-100 bg-amber-50/60 px-4 py-4 text-left transition hover:border-amber-200 hover:bg-amber-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{block.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{block.csku}</p>
                    <div className="mt-2.5"><StatusBadge status={block.status} /></div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                </button>
              )) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                  <p className="text-sm font-semibold text-slate-700">Tudo em dia</p>
                  <p className="text-xs text-slate-400">Não há itens aguardando sua aprovação ou envio de arquivos.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* RECENT BLOCKS + SUPPORT */}
      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Meus blocos</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {myBlocks.length > 0 ? "Acompanhe cada produto" : "Nenhum bloco iniciado"}
              </h3>
            </div>
            {myBlocks.length > 0 && <button onClick={() => setPage("blocks")} className="text-sm font-semibold text-cyan-700 transition hover:text-cyan-800">Ver todos</button>}
          </div>
          <div className="mt-6 space-y-3">
            {myBlocks.length > 0 ? myBlocks.slice(0, 5).map((b) => (
              <button key={b.id} onClick={() => { setSelectedBlock(b.id); setPage("block_detail"); }} className="flex w-full items-center justify-between rounded-[24px] border border-slate-200/80 bg-slate-50/75 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-100/80">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{b.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{b.csku}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <StatusBadge status={b.status} />
                    <ServiceBadge type={b.svc} />
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
              </button>
            )) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center rounded-[22px] border-2 border-dashed border-slate-200">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <Box className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Seus blocos aparecerão aqui</p>
                  <p className="mt-1 text-xs text-slate-400">Após o onboarding, a equipe ATT criará os blocos dos seus produtos.</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          {/* Published */}
          <Card className="p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Publicações ao vivo</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{publishedCount > 0 ? `${publishedCount} produto${publishedCount > 1 ? "s" : ""} no catálogo` : "Nenhuma publicação ainda"}</h3>
              </div>
              {publishedCount > 0 && <Badge className="border-emerald-200/80 bg-emerald-50 text-emerald-700">{publishedCount} ao vivo</Badge>}
            </div>
            <div className="mt-5 space-y-3">
              {liveBlocks.length ? liveBlocks.map((block) => {
                const publication = publications.find((pub) => pub.blockId === block.id);
                return (
                  <div key={block.id} className="rounded-[22px] border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-sm font-semibold text-slate-800">{block.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{block.csku}</p>
                    {publication && (
                      <a href={publication.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 transition hover:text-cyan-800">
                        Abrir experiência 3D <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                );
              }) : (
                <p className="text-xs text-slate-400 leading-5">Assim que um produto for aprovado e publicado, você poderá acessar o link da experiência 3D e de realidade aumentada diretamente aqui.</p>
              )}
            </div>
          </Card>

          {/* Support */}
          <Card className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Suporte</p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Fale com a equipe ATT</h3>
            <p className="mt-1.5 text-xs text-slate-500 leading-5">Em caso de dúvidas sobre prazos, aprovações ou arquivos, entre em contato diretamente.</p>
            <div className="mt-4 space-y-2.5 text-sm">
              <a href="mailto:info@archtechtour.com" className="flex items-center gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/75 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-100/60">
                <MessageSquare className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-700">info@archtechtour.com</span>
              </a>
              <a href="https://archtechtour.com" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/75 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-100/60">
                <Globe className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-700">archtechtour.com</span>
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BLOCKS LIST
// ============================================================
const isClientRole = (u: SeedUser) => u.role === "client" || u.role === "freelancer_bim";
// Filtros da lista de blocos sobrevivem a abrir/editar um bloco e voltar. Antes
// viviam só no useState da tela: salvar um produto devolvia a Jéssica para
// "todas as marcas / todos os status" e ela tinha de filtrar tudo de novo.
type BlockSort = "recent" | "sku" | "sku_desc" | "title" | "due";
const BLOCKS_LIST_MEMORY: { search: string; status: string; client: string; sort: BlockSort; grid: boolean } = { search: "", status: "all", client: "all", sort: "recent", grid: false };
/** "2026_21_GH…" < "2026_98_GH…" < "2026_137_GH…" — comparação que entende número dentro do texto. */
const naturalCompare = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

function BlocksListPage({ user, setPage, setSelectedBlock, initialStatus = "all" }: { user: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void; initialStatus?: string }) {
  const { blocks, setBlocks, activities, setActivities, tickets, setTickets, users } = useContext(AppContext);
  // Modo grade (Jéssica/Igor, 2026-09-23): edita etapa, SKP/RVT/GSM, responsável e
  // entrega direto na linha, como no Notion — sem abrir bloco por bloco.
  const [grid, setGrid] = useState(BLOCKS_LIST_MEMORY.grid);
  useEffect(() => { BLOCKS_LIST_MEMORY.grid = grid; }, [grid]);
  const patchBlock = (id: string, patch: Partial<SeedBlock>) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const changeStatus = (b: SeedBlock, status: BlockStatus) => {
    const nb = withStatus(b, status);
    setBlocks((prev) => prev.map((x) => (x.id === nb.id ? nb : x)));
    setTickets((prev) => {
      const synced = syncTicketsWithBlock(prev, nb);
      const phase = PRODUCTION_PHASE_LABELS[status];
      if (!phase || synced.some((t) => t.blockId === nb.id && isOpenTicket(t))) return synced;
      return [...synced, { id: `tk_${Date.now()}`, clientId: nb.clientId, blockId: nb.id, title: `${nb.title} – ${phase}`, plan: nb.svc, slaDate: nb.dueDate || addDaysISO(todayISO(), SLA_DAYS), priority: nb.pri, assignedTo: nb.owner, status: "new" as TicketStatus, createdAt: new Date().toISOString() }];
    });
  };
  const changeOwner = (b: SeedBlock, owner: string | undefined) => {
    patchBlock(b.id, { owner });
    setTickets((prev) => prev.map((t) => (t.blockId === b.id && isOpenTicket(t) ? { ...t, assignedTo: owner } : t)));
  };
  const toggleBim = (b: SeedBlock, k: "skp" | "rvt" | "gsm") => {
    const bim = { skp: false, rvt: false, gsm: false, ...(b.bim ?? {}), [k]: !b.bim?.[k] };
    patchBlock(b.id, { bim: bim.skp || bim.rvt || bim.gsm ? bim : undefined });
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const cell = "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-cyan-400";
  const internalUsers = users.filter((u) => u.role !== "client" && u.role !== "freelancer_bim" && u.active);
  const canGrid = !isClientRole(user);
  const [search, setSearch] = useState(BLOCKS_LIST_MEMORY.search);
  // Card do dashboard (initialStatus) vence a memória; sem ele, vale o último filtro usado.
  const [filterStatus, setFilterStatus] = useState(initialStatus !== "all" ? initialStatus : BLOCKS_LIST_MEMORY.status);
  const [filterClient, setFilterClient] = useState(BLOCKS_LIST_MEMORY.client);
  const [sort, setSort] = useState<BlockSort>(BLOCKS_LIST_MEMORY.sort);
  useEffect(() => { Object.assign(BLOCKS_LIST_MEMORY, { search, status: filterStatus, client: filterClient, sort }); }, [search, filterStatus, filterClient, sort]);
  const hasFilters = !!search || filterStatus !== "all" || filterClient !== "all";
  const clearFilters = () => { setSearch(""); setFilterStatus("all"); setFilterClient("all"); };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const isClient = user.role === "client";

  const filtered = useMemo(() => {
    let list = isClient ? blocks.filter((b) => b.clientId === user.clientId) : blocks;
    if (search) list = list.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()) || b.sku.toLowerCase().includes(search.toLowerCase()) || b.csku.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== "all") list = list.filter((b) => b.status === filterStatus);
    if (filterClient !== "all") list = list.filter((b) => b.clientId === filterClient);
    if (sort !== "recent") {
      list = [...list].sort((a, b) =>
        sort === "sku" ? naturalCompare(a.sku, b.sku)
        : sort === "sku_desc" ? naturalCompare(b.sku, a.sku)
        : sort === "title" ? naturalCompare(a.title, b.title)
        : (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
    }
    return list;
  }, [blocks, search, filterStatus, filterClient, sort, isClient, user.clientId]);

  const exportCSV = () => {
    const headers = ["SKU Interno", "SKU Cliente", "Título", "Cliente", "Tipo Serviço", "Status", "Prioridade", "Responsável", "Criado em", "Materiais recebidos", "Entrega prevista"];
    const rows = filtered.map((b) => [
      b.sku, b.csku, b.title, getClientName(b.clientId),
      SERVICE_LABELS[b.svc], STATUS_LABELS[b.status], PRIORITY_LABELS[b.pri],
      b.owner ? getUserName(b.owner) : "", fmtDate(b.created), b.materialsAt ? fmtDate(b.materialsAt) : "", b.dueDate ? fmtDate(b.dueDate) : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `blocos_archtechtour_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleCreateBlock = (data: { title: string; clientSku: string; clientId: string; contractId: string; serviceType: ServiceType; priority: Priority }): string => {
    const clientBlocks = blocks.filter((b) => b.clientId === data.clientId);
    const n = clientBlocks.length + 1;
    const clientCode = getClientCode(data.clientId);
    const newBlock: SeedBlock = {
      id: `pb_${Date.now()}`, clientId: data.clientId, contractId: data.contractId,
      n, sku: `${clientCode}-${String(n).padStart(3, "0")}`, csku: data.clientSku,
      title: data.title, svc: data.serviceType, status: "draft",
      pri: data.priority, created: new Date().toISOString().slice(0, 10),
    };
    setBlocks([...blocks, newBlock]); // o servidor registra "Bloco criado" ao gravar

    // Auto-cria ticket inicial na fila — Jessica (admin) atribui responsável depois
    // Prazo provisório; quando os materiais chegarem o bloco recalcula (withStatus) e o ticket acompanha.
    const newTicket: ProductionTicket = {
      id: `tk_${Date.now()}`,
      clientId: data.clientId,
      blockId: newBlock.id,
      title: `${data.title} – Modelagem`,
      plan: data.serviceType,
      slaDate: addDaysISO(todayISO(), SLA_DAYS),
      priority: data.priority,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    setTickets([...tickets, newTicket]);

    setShowCreateModal(false);
    setSelectedBlock(newBlock.id);
    setPage("block_detail");
    return newBlock.id;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold text-slate-800">{isClient ? "Meus Blocos" : "Todos os Blocos"}</h1><p className="text-sm text-slate-500">{filtered.length} blocos</p></div>
        <div className="flex gap-2">
          {!isClient && (
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <BarChart3 className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          )}
          {canGrid && (
            <button onClick={() => setGrid(!grid)} title="Editar etapa, SKP/RVT/GSM, responsável e entrega direto na lista" className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${grid ? "border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
              <Layers className="w-3.5 h-3.5" /> {grid ? "Grade: editando" : "Editar em grade"}
            </button>
          )}
          {can(user, "blocks", "create") && (
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Novo Bloco
            </button>
          )}
        </div>
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, SKU..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
            <option value="all">Todos os Status</option>
            {(Object.keys(STATUS_LABELS) as BlockStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          {!isClient && (
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
              <option value="all">Todos os Clientes</option>
              {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={sort} onChange={(e) => setSort(e.target.value as BlockSort)} title="Ordenação da lista" className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
            <option value="recent">Ordem: padrão</option>
            <option value="sku">Ordem: numérica (SKU ↑)</option>
            <option value="sku_desc">Ordem: numérica (SKU ↓)</option>
            <option value="title">Ordem: nome A–Z</option>
            <option value="due">Ordem: entrega mais próxima</option>
          </select>
          {hasFilters && <button onClick={clearFilters} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2">Limpar filtros</button>}
        </div>
        {hasFilters && <p className="mt-2 text-[11px] text-slate-400">{filtered.length} bloco{filtered.length === 1 ? "" : "s"} no filtro · o filtro fica guardado enquanto você abre e edita os blocos.</p>}
      </Card>
      <Card>
        <DataTable data={filtered} onRowClick={(row) => { setSelectedBlock(row.id); setPage("block_detail"); }} columns={[
          { label: "SKU", render: (r: SeedBlock) => <span className="font-mono text-xs text-slate-500">{r.sku}</span> },
          { label: "Título", render: (r: SeedBlock) => <div><p className="font-medium text-slate-800">{r.title}</p><p className="text-xs text-slate-400">{r.csku}</p></div> },
          ...(!isClient ? [{ label: "Cliente", render: (r: SeedBlock) => <span className="text-xs">{getClientCode(r.clientId)}</span> }] : []),
          { label: "Tipo", render: (r: SeedBlock) => <ServiceBadge type={r.svc} /> },
          { label: "Status", render: (r: SeedBlock) => {
            const override = special(user, "statusOverride"); const transition = special(user, "transition");
            if (!grid || (!override && !transition)) return <StatusBadge status={r.status} />;
            const opts = override ? (Object.keys(STATUS_LABELS) as BlockStatus[]) : Array.from(new Set([r.status, ...(VALID_TRANSITIONS[r.status] || [])]));
            return (
              <span onClick={stop}>
                <select value={r.status} onChange={(e) => changeStatus(r, e.target.value as BlockStatus)} className={`${cell} max-w-[180px] ${STATUS_COLORS[r.status]?.replace("border-", "border-") ?? ""}`}>
                  {opts.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                </select>
              </span>
            );
          } },
          ...(!isClient ? [{ label: "SKP · RVT · GSM", render: (r: SeedBlock) => {
            const keys = [["skp", "SKP"], ["rvt", "RVT"], ["gsm", "GSM"]] as const;
            if (!grid || !can(user, "blocks", "edit")) return <span className="flex gap-1">{keys.map(([k, l]) => <span key={k} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.bim?.[k] ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-300"}`}>{l}</span>)}</span>;
            return (
              <span onClick={stop} className="flex gap-2">
                {keys.map(([k, l]) => <label key={k} className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-600"><input type="checkbox" checked={!!r.bim?.[k]} onChange={() => toggleBim(r, k)} className="h-3.5 w-3.5 rounded border-slate-300 accent-teal-600" />{l}</label>)}
              </span>
            );
          } }] : []),
          { label: "Prioridade", render: (r: SeedBlock) => <PriorityDot priority={r.pri} /> },
          ...(!isClient ? [{ label: "Responsável", render: (r: SeedBlock) => grid ? (
            <span onClick={stop}>
              <select value={r.owner ?? ""} onChange={(e) => changeOwner(r, e.target.value || undefined)} className={`${cell} max-w-[150px]`}>
                <option value="">—</option>
                {internalUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </span>
          ) : <span className="text-xs text-slate-500">{r.owner ? getUserName(r.owner) : "—"}</span> }] : []),
          { label: "Entrega", render: (r: SeedBlock) => {
            const late = !!r.dueDate && r.dueDate < todayISO() && !["published", "archived", "approved"].includes(r.status);
            if (grid && canEditDeadlines(user)) {
              return <span onClick={stop}><input type="date" value={r.dueDate ?? ""} onChange={(e) => { const iso = e.target.value; const nb = { ...r, dueDate: iso || undefined, dueManual: iso ? true : undefined }; patchBlock(r.id, { dueDate: nb.dueDate, dueManual: nb.dueManual }); setTickets((prev) => syncTicketsWithBlock(prev, nb)); }} className={`${cell} ${late ? "border-rose-300 text-rose-600" : ""}`} /></span>;
            }
            if (!r.dueDate) return <span className="text-xs text-slate-300">—</span>;
            return <span className={`text-xs whitespace-nowrap ${late ? "font-semibold text-rose-600" : "text-slate-500"}`}>{fmtDate(r.dueDate)}</span>;
          } },
        ]} />
        {grid && <p className="px-5 py-3 text-[11px] text-slate-400">Modo grade: as mudanças gravam na hora e entram no log de atividades. Clique no nome do produto para abrir o bloco.</p>}
      </Card>

      {/* Modal Criar Bloco */}
      {showCreateModal && <CreateBlockModal user={user} onClose={() => setShowCreateModal(false)} onCreate={handleCreateBlock} />}
    </div>
  );
}

// ============================================================
// UPLOAD MODAL — S3 upload + Claude AI analysis
// ============================================================
interface AnalyzeResult {
  score: number;
  approved: boolean;
  summary: string;
  issues: string[];
  suggestions: string[];
  notes?: string[]; // internal ATT team notes — never shown to clients
}

/** Normalize a filename: lowercase, remove accents, spaces → underscores */
function normalizeAssetName(original: string): string {
  const lastDot = original.lastIndexOf(".");
  const ext = lastDot > 0 ? original.slice(lastDot).toLowerCase() : "";
  const base = original.slice(0, lastDot > 0 ? lastDot : undefined);
  const normalized = base
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
  return normalized + ext;
}

function UploadModal({ blockId, clientId, allowedCategories, onClose, onUploaded }: {
  blockId: string;
  clientId: string;
  allowedCategories?: AssetCategory[];
  onClose: () => void;
  onUploaded: (asset: SeedAsset) => void;
}) {
  const { currentUser } = useContext(AppContext);
  const isClient = currentUser?.role === "client";
  const categories = allowedCategories ?? (Object.keys(CATEGORY_LABELS) as AssetCategory[]);
  const [cat, setCat] = useState<AssetCategory>(categories[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<"idle" | "processing" | "done">("idle");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ file: File; result: AnalyzeResult | null; error?: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert a File to base64 string (data URI prefix removed)
  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const handleFiles = (newFiles: File[]) => {
    setFiles(newFiles);
    setStage("idle");
    setResults([]);
    setCurrentIdx(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) handleFiles(dropped);
  };

  const doUpload = async () => {
    if (!files.length) return;
    setStage("processing");
    const allResults: { file: File; result: AnalyzeResult | null; error?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentIdx(i);
      setProgress(0);

      try {
        // 1. Get presigned URL
        const uploadResp = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            category: cat,
            blockId,
            clientId,
          }),
        });
        if (!uploadResp.ok) {
          const err = await uploadResp.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao obter URL de upload");
        }
        const { uploadUrl, readUrl, key: s3Key } = await uploadResp.json();
        setProgress(35);

        // 2. Upload directly to S3
        const s3Resp = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!s3Resp.ok) throw new Error("Falha no upload para S3");
        setProgress(65);

        // 3. AI Analysis
        const isImg = /^image\//i.test(file.type) || /\.(jpe?g|png|webp|gif|tiff?|bmp|heic)$/i.test(file.name);
        const MAX_B64 = 4.5 * 1024 * 1024; // 4.5 MB — safe Claude Vision limit
        let imageBase64: string | null = null;
        if (isImg && file.size <= MAX_B64) {
          try { imageBase64 = await fileToBase64(file); } catch { /* skip */ }
        }
        const analyzeResp = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: readUrl,
            fileName: file.name,
            category: cat,
            mimeType: file.type || "application/octet-stream",
            imageBase64,                         // null for large/non-image files
            imageMimeType: file.type || null,
          }),
        });
        setProgress(95);
        const analysis = analyzeResp.ok ? await analyzeResp.json() : null;
        setProgress(100);

        // 4. Register asset
        const newAsset: SeedAsset = {
          id: `ast_${Date.now()}_${i}`,
          blockId,
          cat,
          name: normalizeAssetName(file.name),
          size: file.size,
          v: 1,
          by: currentUser?.id ?? "u1",
          uploadedAt: new Date().toISOString(),
          analysis: analysis ?? undefined,
          key: s3Key,
        };
        onUploaded(newAsset);
        allResults.push({ file, result: analysis });
      } catch (e: unknown) {
        allResults.push({ file, result: null, error: e instanceof Error ? e.message : "Erro desconhecido" });
      }
    }

    setResults(allResults);
    setStage("done");
  };

  const reset = () => {
    setFiles([]);
    setStage("idle");
    setResults([]);
    setProgress(0);
    setCurrentIdx(0);
  };

  const approvedCount = results.filter((r) => r.result?.approved).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Upload de Material</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Category selector */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Categoria do Material</label>
            <select value={cat} onChange={(e) => { setCat(e.target.value as AssetCategory); reset(); }}
              disabled={stage === "processing"}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
              {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            {CATEGORY_HINTS[cat] && (
              <p className="mt-1.5 text-xs text-slate-400">{CATEGORY_HINTS[cat]}</p>
            )}
          </div>

          {/* Drop zone */}
          {stage === "idle" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-all"
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  if (selected.length > 0) handleFiles(selected);
                }}
              />
              {files.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FileText className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-medium text-slate-700">
                      {files.length} arquivo{files.length > 1 ? "s" : ""} selecionado{files.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                        <span className="truncate flex-1 text-left">{f.name}</span>
                        <span className="shrink-0 text-slate-400">{fmtSize(f.size)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Clique para alterar seleção</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium text-slate-500">Arraste ou clique para selecionar</p>
                  <p className="text-xs text-slate-400">Múltiplos arquivos · Imagens, PDF, CAD, vídeos…</p>
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {stage === "processing" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
                <span>Arquivo {currentIdx + 1} de {files.length}</span>
                <span className="font-medium text-slate-700 truncate max-w-[200px]">{files[currentIdx]?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-slate-500 w-8 text-right">{progress}%</span>
              </div>
              <p className="text-sm text-center text-slate-500">⏳ Enviando e analisando…</p>
            </div>
          )}

          {/* Results */}
          {stage === "done" && results.length > 0 && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                approvedCount === results.length
                  ? "bg-emerald-50 text-emerald-700"
                  : approvedCount > 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {approvedCount === results.length
                  ? <Check className="w-4 h-4 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 shrink-0" />}
                {approvedCount === results.length
                  ? `${results.length} arquivo${results.length > 1 ? "s" : ""} aprovado${results.length > 1 ? "s" : ""} pelo agente`
                  : `${approvedCount} de ${results.length} aprovado${approvedCount !== 1 ? "s" : ""} pelo agente`}
              </div>
              {results.map(({ file, result, error }, i) => {
                if (error) return (
                  <div key={i} className="border border-red-200 bg-red-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-red-700 truncate">{file.name}</p>
                    <p className="text-xs text-red-600 mt-0.5">{error}</p>
                  </div>
                );
                if (!result) return (
                  <div key={i} className="border border-emerald-200 bg-emerald-50 rounded-xl p-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-xs font-medium text-emerald-700 truncate">{file.name} · Enviado</p>
                  </div>
                );
                const rBg = result.approved ? "border-emerald-200 bg-emerald-50" : result.score >= 50 ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50";
                const rColor = result.score >= 80 ? "text-emerald-600" : result.score >= 50 ? "text-amber-600" : "text-red-600";
                return (
                  <div key={i} className={`border rounded-xl p-3 space-y-2 ${rBg}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700 truncate flex-1">{file.name}</p>
                      <span className={`text-sm font-bold shrink-0 ${rColor}`}>{result.score}<span className="text-xs font-normal text-slate-400">/100</span></span>
                    </div>
                    <p className="text-xs text-slate-600">{result.summary}</p>
                    {result.issues?.length > 0 && (
                      <div className="space-y-0.5">
                        {result.issues.slice(0, 3).map((iss, j) => (
                          <div key={j} className="flex items-start gap-1 text-xs text-red-700">
                            <X className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />{iss}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.suggestions?.length > 0 && (
                      <div className="space-y-0.5">
                        {result.suggestions.slice(0, 3).map((s, j) => (
                          <div key={j} className="flex items-start gap-1 text-xs text-slate-600">
                            <span className="text-emerald-500 shrink-0">→</span>{s}
                          </div>
                        ))}
                      </div>
                    )}
                    {!isClient && (result as AnalyzeResult & { notes?: string[] }).notes?.length ? (
                      <div className="space-y-0.5 border-t border-dashed border-slate-300 pt-1.5 mt-1">
                        <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">🔒 Notas internas</p>
                        {((result as AnalyzeResult & { notes?: string[] }).notes ?? []).slice(0, 3).map((n, j) => (
                          <div key={j} className="flex items-start gap-1 text-xs text-violet-700">
                            <span className="text-violet-400 shrink-0">→</span>{n}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 p-5 border-t border-slate-100">
          {stage === "done" ? (
            <>
              <button onClick={reset} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                Enviar mais
              </button>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                Concluir
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button
                onClick={doUpload}
                disabled={!files.length || stage === "processing"}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                <Upload className="w-4 h-4" />
                {stage === "processing"
                  ? "Processando…"
                  : files.length > 1
                  ? `Enviar ${files.length} arquivos`
                  : "Enviar e Analisar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Create Block Modal ---
function CreateBlockModal({ user, onClose, onCreate }: {
  user: SeedUser;
  onClose: () => void;
  onCreate: (data: { title: string; clientSku: string; clientId: string; contractId: string; serviceType: ServiceType; priority: Priority }) => string;
}) {
  const { assets, setAssets, setActivities, blocks } = useContext(AppContext);
  const isClient = user.role === "client";
  const [title, setTitle] = useState("");
  const [clientSku, setClientSku] = useState("");
  const [clientId, setClientId] = useState(isClient ? user.clientId || "" : "");
  const [contractId, setContractId] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("standard");
  const [priority, setPriority] = useState<Priority>("normal");
  // Upload step
  const [uploadBlockId, setUploadBlockId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const availableContracts = CONTRACTS.filter((c) => c.clientId === clientId && c.active);
  const selectedContract = CONTRACTS.find((c) => c.id === contractId);
  const hasCapacity = selectedContract ? usedBlocksOf(selectedContract.id, blocks) < selectedContract.totalBlocks : false;
  const canSubmit = title.trim() && clientSku.trim() && clientId && contractId && hasCapacity;
  const requiredCats = READINESS_RULES[serviceType] || [];

  // If block was created, show the upload step
  if (uploadBlockId) {
    return (
      <UploadModal
        blockId={uploadBlockId}
        clientId={clientId}
        allowedCategories={Object.keys(CATEGORY_LABELS) as AssetCategory[]}
        onClose={onClose}
        onUploaded={(asset) => {
          setAssets([...assets, asset]);
          // Arquivos vão direto ao S3 (sem tabela de estado): o log é enviado na hora.
          logActivity({ type: "asset_uploaded", entity: "assets", blockId: uploadBlockId, clientId, entityId: asset.id, desc: `Arquivo enviado: ${asset.name} (${CATEGORY_LABELS[asset.cat]})` })
            .then((a) => { if (a) setActivities((prev) => [...prev, a]); });
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Novo Bloco de Produto</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Título do Produto *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Mesa de Jantar Elegance 1.8m" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">SKU do Cliente *</label>
            <input value={clientSku} onChange={(e) => setClientSku(e.target.value)} placeholder="Ex: VRG-MESA-01" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 font-mono" />
          </div>
          {!isClient && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cliente *</label>
              <select value={clientId} onChange={(e) => { setClientId(e.target.value); setContractId(""); setPendingFiles({}); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                <option value="">Selecione...</option>
                {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Contrato *</label>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40" disabled={!clientId}>
              <option value="">{clientId ? "Selecione o contrato..." : "Selecione o cliente primeiro"}</option>
              {availableContracts.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.totalBlocks - usedBlocksOf(c.id, blocks)} disponíveis)</option>)}
            </select>
            {contractId && !hasCapacity && <p className="text-xs text-red-500 mt-1">Este contrato não tem blocos disponíveis.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de Serviço</label>
              <select value={serviceType} onChange={(e) => { setServiceType(e.target.value as ServiceType); setPendingFiles({}); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                {(Object.entries(SERVICE_LABELS) as [ServiceType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Prioridade</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* File upload per required category */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">Materiais obrigatórios — {SERVICE_LABELS[serviceType]}</p>
              <span className="text-xs text-slate-400">{Object.keys(pendingFiles).length}/{requiredCats.length} anexados</span>
            </div>
            <div className="divide-y divide-slate-100">
              {requiredCats.map((cat) => {
                const f = pendingFiles[cat];
                return (
                  <div key={cat} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {f
                        ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700">{CATEGORY_LABELS[cat]}</p>
                        {f && <p className="text-xs text-slate-400 truncate max-w-[200px]">{f.name} · {fmtSize(f.size)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="file"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[cat] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setPendingFiles((prev) => ({ ...prev, [cat]: file }));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[cat]?.click()}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                      >
                        {f ? "Trocar" : "Anexar"}
                      </button>
                      {f && (
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => { const n = { ...prev }; delete n[cat]; return n; })}
                          className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {Object.keys(pendingFiles).length > 0 && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {Object.keys(pendingFiles).length} arquivo(s) prontos — serão enviados e analisados após criar o bloco
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
          <button
            onClick={() => {
              if (!canSubmit) return;
              const newId = onCreate({ title: title.trim(), clientSku: clientSku.trim(), clientId, contractId, serviceType, priority });
              if (Object.keys(pendingFiles).length > 0) {
                setUploadBlockId(newId);
              }
            }}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {Object.keys(pendingFiles).length > 0 ? `Criar e Enviar ${Object.keys(pendingFiles).length} arquivo(s)` : "Criar Bloco"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ============================================================
// ASSET ROW — shows file + expandable AI analysis
// ============================================================
function AssetRow({ asset }: { asset: SeedAsset }) {
  const { currentUser } = useContext(AppContext);
  const isClient = currentUser?.role === "client";
  const [expanded, setExpanded] = useState(false);
  const a = asset.analysis;
  const scoreColor = a
    ? a.score >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : a.score >= 50 ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-red-600 bg-red-50 border-red-200"
    : "";

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-700 truncate">{asset.name}</span>
          <Badge className="bg-slate-100 text-slate-500 border-slate-200 flex-shrink-0">v{asset.v}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-400">{fmtSize(asset.size)}</span>
          {asset.key && (
            <>
              {/\.(png|jpe?g|webp|gif|pdf|svg)$/i.test(asset.name) && (
                <a href={`/api/assets/file?key=${encodeURIComponent(asset.key)}&name=${encodeURIComponent(asset.name)}&inline=1`} target="_blank" rel="noreferrer" title="Abrir" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Eye className="w-4 h-4" /></a>
              )}
              <a href={`/api/assets/file?key=${encodeURIComponent(asset.key)}&name=${encodeURIComponent(asset.name)}`} title="Baixar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Download className="w-4 h-4" /></a>
            </>
          )}
          {a ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${scoreColor}`}
            >
              {a.approved ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {a.score}/100
            </button>
          ) : (
            <span className="text-xs text-slate-300 italic">sem análise</span>
          )}
        </div>
      </div>
      {expanded && a && (
        <div className={`mx-3 mb-3 rounded-xl border p-3 space-y-2 text-xs ${
          a.score >= 80 ? "bg-emerald-50 border-emerald-200" :
          a.score >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
        }`}>
          <p className="font-medium text-slate-700">{a.summary}</p>
          {a.issues?.length > 0 && (
            <div className="space-y-0.5">
              <p className="font-semibold text-red-600 uppercase tracking-wide text-[10px]">Problemas</p>
              {a.issues.map((iss, i) => (
                <div key={i} className="flex items-start gap-1 text-red-700">
                  <X className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-400" />{iss}
                </div>
              ))}
            </div>
          )}
          {a.suggestions?.length > 0 && (
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Recomendações</p>
              {a.suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-1 text-slate-600">
                  <span className="text-emerald-500 flex-shrink-0">→</span>{s}
                </div>
              ))}
            </div>
          )}
          {!isClient && a.notes && a.notes.length > 0 && (
            <div className="space-y-0.5 border-t border-dashed border-slate-300 pt-2 mt-1">
              <p className="font-semibold text-violet-600 uppercase tracking-wide text-[10px]">🔒 Notas internas (equipe ATT)</p>
              {a.notes.map((n, i) => (
                <div key={i} className="flex items-start gap-1 text-violet-700">
                  <span className="text-violet-400 flex-shrink-0">→</span>{n}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600 underline text-[10px]">Fechar</button>
        </div>
      )}
    </div>
  );
}

// BLOCK DETAIL
// ============================================================
type BlockEditData = { title: string; sku: string; csku: string; modeler?: string; bim?: { skp: boolean; rvt: boolean; gsm: boolean } };
function BlockEditModal({ initial, onClose, onSave }: {
  initial: SeedBlock; onClose: () => void;
  onSave: (d: BlockEditData) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [sku, setSku] = useState(initial.sku);
  const [csku, setCsku] = useState(initial.csku);
  const [modeler, setModeler] = useState(initial.modeler ?? "");
  const [bim, setBim] = useState(initial.bim ?? { skp: false, rvt: false, gsm: false });
  const canSave = title.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Editar bloco</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-slate-500">Nome do produto *</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Ex: Sofá Caraíva" /></div>
          <div><label className="text-xs font-medium text-slate-500">SKU interno</label><input value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono" placeholder="2024-TIDELLI-01" /></div>
          <div><label className="text-xs font-medium text-slate-500">SKU do cliente</label><input value={csku} onChange={(e) => setCsku(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono" placeholder="Código da marca" /></div>
          <div><label className="text-xs font-medium text-slate-500">Modelador</label><input value={modeler} onChange={(e) => setModeler(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Quem modelou" /></div>
          <div>
            <label className="text-xs font-medium text-slate-500">Arquivos BIM entregues</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {([["skp", "SketchUp"], ["rvt", "Revit"], ["gsm", "GSM (ArchiCAD)"]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setBim({ ...bim, [k]: !bim[k] })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${bim[k] ? "bg-teal-600 text-white border-teal-600" : "bg-white text-slate-500 border-slate-200"}`}>{bim[k] ? "✓ " : ""}{label}</button>
              ))}
            </div>
          </div>
          {initial.notionUrl && <p className="text-xs text-slate-400">Importado do Notion{initial.notionTech ? ` (etapa lá: ${initial.notionTech})` : ""} · <a href={initial.notionUrl} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">abrir no Notion</a></p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onSave({ title: title.trim(), sku: sku.trim(), csku: csku.trim(), modeler: modeler.trim() || undefined, bim })} disabled={!canSave} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-30 hover:bg-slate-800">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function BlockDetailPage({ blockId, user, setPage }: { blockId: string; user: SeedUser; setPage: (p: string) => void }) {
  const { blocks, setBlocks, activities, setActivities, assets, setAssets, publications, setPublications, tickets, setTickets, users } = useContext(AppContext);
  const { forBlock: finishesForBlock } = useFinishes();
  const block = blocks.find((b) => b.id === blockId);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showUpload, setShowUpload] = useState(false);

  // Auto-advance block status when all required files are uploaded
  useEffect(() => {
    if (!block || block.status !== "awaiting_client_files") return;
    const required = READINESS_RULES[block.svc] || [];
    if (!required.length) return;
    const blockAssets = assets.filter((a) => a.blockId === block.id);
    const cats = new Set(blockAssets.map((a) => a.cat));
    if (required.every((c) => cats.has(c))) {
      // Materiais completos = começa a contar o prazo de entrega (withStatus).
      const next = withStatus(block, "client_files_under_review");
      setBlocks(blocks.map((b) => (b.id === block.id ? next : b)));
      setTickets((prev) => syncTicketsWithBlock(prev, next));
    }
  }, [assets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!block) return <EmptyState icon={Package} title="Bloco não encontrado" />;

  const contract = CONTRACTS.find((c) => c.id === block.contractId);
  const blockAssets = assets.filter((a) => a.blockId === block.id);
  const blockActivities = activities.filter((a) => a.blockId === block.id && !isNavigation(a)).sort((a, b) => b.at.localeCompare(a.at));
  const approvalHistory = blockActivities.filter((a) => a.type === "approval_approved" || a.type === "approval_rejected");
  const approvalRule = APPROVAL_NEXT[block.status];
  const readiness = checkReadiness(block.id, block.svc, assets, isFilled(finishesForBlock(block.id)));
  const publication = publications.find((p) => p.blockId === block.id);
  const validNext = VALID_TRANSITIONS[block.status] || [];
  const isClient = user.role === "client";
  const [confirmTransition, setConfirmTransition] = useState<BlockStatus | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const handleEditSave = (d: BlockEditData) => {
    // Nenhum arquivo BIM marcado = campo ausente (igual ao bloco original). Se
    // gravasse {skp:false,rvt:false,gsm:false}, o log acusaria "alterou: arquivos BIM"
    // toda vez que alguém salvasse o bloco sem mexer nisso.
    const bim = d.bim && (d.bim.skp || d.bim.rvt || d.bim.gsm) ? d.bim : undefined;
    const next: SeedBlock = { ...block, title: d.title, sku: d.sku, csku: d.csku, modeler: d.modeler, bim };
    setBlocks(blocks.map((b) => (b.id === block.id ? next : b)));
    if (d.title !== block.title) setTickets((prev) => syncTicketsWithBlock(prev, next)); // título do ticket segue o nome do produto
    setShowEdit(false);
  };

  // Data de entrega geral do bloco. Digitar = manual (o automático para de mexer);
  // "voltar ao automático" recalcula a partir da entrega dos materiais.
  const setDueDate = (iso: string) => {
    const next: SeedBlock = { ...block, dueDate: iso || undefined, dueManual: iso ? true : undefined };
    setBlocks(blocks.map((b) => (b.id === block.id ? next : b)));
    setTickets((prev) => syncTicketsWithBlock(prev, next));
  };
  const resetDueDate = () => {
    const next: SeedBlock = { ...block, dueManual: undefined, dueDate: block.materialsAt ? addDaysISO(block.materialsAt, SLA_DAYS) : undefined };
    setBlocks(blocks.map((b) => (b.id === block.id ? next : b)));
    setTickets((prev) => syncTicketsWithBlock(prev, next));
  };
  const setMaterialsAt = (iso: string) => {
    const next: SeedBlock = { ...block, materialsAt: iso || undefined, ...(block.dueManual ? {} : { dueDate: iso ? addDaysISO(iso, SLA_DAYS) : undefined }) };
    setBlocks(blocks.map((b) => (b.id === block.id ? next : b)));
    setTickets((prev) => syncTicketsWithBlock(prev, next));
  };

  const handleDelete = () => {
    const pubCount = publications.filter((p) => p.blockId === block.id).length;
    const tkCount = tickets.filter((t) => t.blockId === block.id).length;
    if (!confirm(`Excluir o bloco "${block.title}"?\n\nIsso remove também: ${pubCount} publicação(ões) e ${tkCount} ticket(s) vinculados. Ação irreversível.`)) return;
    setPublications(publications.filter((p) => p.blockId !== block.id));
    setTickets(tickets.filter((t) => t.blockId !== block.id));
    setBlocks(blocks.filter((b) => b.id !== block.id));
    setPage("blocks");
  };

  const MAX_REVISIONS = MAX_CLIENT_REVISIONS;
  const revisions = block.clientRevisions ?? 0;
  const revisionLimitReached = revisions >= MAX_REVISIONS;
  const revisionWarning = revisions === MAX_REVISIONS - 1;

  // Bloco que entra numa fase de produção sem ticket aberto ganha um ticket
  // automático (antes só o "Criar bloco" fazia isso — bloco antigo mudando para
  // "Em Modelagem" ficava sem ticket na fila).
  const ensureTicket = (status: BlockStatus, owner: string | undefined, due?: string) => {
    const phase = PRODUCTION_PHASE_LABELS[status];
    if (!phase) return;
    setTickets((prev) => {
      if (prev.some((t) => t.blockId === block.id && isOpenTicket(t))) return prev;
      return [...prev, {
        id: `tk_${Date.now()}`, clientId: block.clientId, blockId: block.id, title: `${block.title} – ${phase}`,
        plan: block.svc, slaDate: due || block.dueDate || addDaysISO(todayISO(), SLA_DAYS), priority: block.pri, assignedTo: owner, status: "new" as TicketStatus,
        createdAt: new Date().toISOString(),
      }];
    });
  };
  const handleTransition = (newStatus: BlockStatus) => {
    const next = withStatus(block, newStatus);
    setBlocks(blocks.map((b) => (b.id === block.id ? next : b))); // o servidor descreve "Status: A → B" ao gravar
    setTickets((prev) => syncTicketsWithBlock(prev, next)); // ticket aberto acompanha a etapa, a situação e o prazo
    ensureTicket(newStatus, block.owner, next.dueDate);
    setConfirmTransition(null);
  };

  // Rejeição do cliente = 1 revisão consumida
  const handleClientDecision = (action: "approve" | "reject") => {
    if (!approvalRule) return;
    if (action === "reject" && revisionLimitReached) return; // bloqueado — revisão paga
    const next = action === "approve" ? approvalRule.approve : approvalRule.reject;
    const updated = withStatus(block, next, action === "reject" ? { clientRevisions: revisions + 1 } : {});
    setBlocks(blocks.map((b) => (b.id === block.id ? updated : b))); // o servidor registra aprovação/revisão do cliente ao gravar
    setTickets((prev) => syncTicketsWithBlock(prev, updated));
  };

  const copyEmbed = () => {
    if (publication?.embed) { navigator.clipboard?.writeText(publication.embed); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setPage("blocks")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">{block.title}</h1>
            <StatusBadge status={block.status} />
            {special(user, "statusOverride") && (
              <select
                value={block.status}
                onChange={(e) => handleTransition(e.target.value as BlockStatus)}
                title="Override de status (admin)"
                className="text-xs px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 font-medium cursor-pointer hover:bg-amber-100"
              >
                {(Object.keys(STATUS_LABELS) as BlockStatus[]).map((s) => (
                  <option key={s} value={s}>↪ {STATUS_LABELS[s]}</option>
                ))}
              </select>
            )}
            {can(user, "blocks", "edit") && (
              <button onClick={() => setShowEdit(true)} title="Editar dados do bloco" className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800">
                <Settings className="w-3 h-3" /> Editar
              </button>
            )}
            {can(user, "blocks", "delete") && (
              <button onClick={handleDelete} title="Excluir bloco" className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                <X className="w-3 h-3" /> Excluir
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
            <span className="font-mono">{block.sku}</span><span>SKU Cliente: {block.csku}</span><span>{getClientName(block.clientId)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2"><ServiceBadge type={block.svc} /><PriorityDot priority={block.pri} /></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["overview", "finishes", "assets", "approvals", "activity", "publication"] as const).map((t) => (
          <TabBtn key={t} active={tab === t} label={{ overview: "Visão Geral", finishes: "Acabamentos", assets: "Arquivos", approvals: "Aprovações", activity: "Atividade", publication: "Publicação" }[t]} onClick={() => setTab(t)} />
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Informações</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-slate-400">Contrato</p><p className="font-medium text-slate-700">{contract?.title || "—"}</p></div>
                <div><p className="text-xs text-slate-400">Nº do Bloco</p><p className="font-medium text-slate-700">#{block.n}</p></div>
                <div><p className="text-xs text-slate-400">Criado em</p><p className="font-medium text-slate-700">{fmtDate(block.created)}</p></div>
                {!isClient && (
                  <div>
                    <p className="text-xs text-slate-400">Responsável</p>
                    {/* Muda aqui e nos tickets abertos do bloco — e o inverso vale na tela Tickets. */}
                    <select
                      value={block.owner ?? ""}
                      onChange={(e) => {
                        const owner = e.target.value || undefined;
                        setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, owner } : b)));
                        setTickets(tickets.map((t) => (t.blockId === block.id && isOpenTicket(t) ? { ...t, assignedTo: owner } : t)));
                        if (owner) ensureTicket(block.status, owner);
                      }}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-cyan-400"
                    >
                      <option value="">Não atribuído</option>
                      {users.filter((u) => u.role !== "client" && u.role !== "freelancer_bim" && u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
                {!isClient && <div><p className="text-xs text-slate-400">Backup</p><p className="font-medium text-slate-700">{block.backup ? getUserName(block.backup) : "—"}</p></div>}
                <div>
                  <p className="text-xs text-slate-400">Entrega prevista</p>
                  {canEditDeadlines(user) ? (
                    <input type="date" value={block.dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-cyan-400" />
                  ) : (
                    <p className="font-medium text-slate-700">{block.dueDate ? fmtDate(block.dueDate) : "—"}</p>
                  )}
                  {!isClient && (
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">
                      {block.dueManual ? "Definida manualmente." : block.materialsAt ? `Automática: materiais + ${SLA_DAYS} dias.` : `Calculada sozinha quando os materiais chegarem (+${SLA_DAYS} dias).`}
                      {block.dueManual && canEditDeadlines(user) && <button onClick={resetDueDate} className="ml-1 font-semibold text-cyan-700 hover:underline">Voltar ao automático</button>}
                    </p>
                  )}
                </div>
                {!isClient && (
                  <div>
                    <p className="text-xs text-slate-400">Materiais recebidos em</p>
                    {canEditDeadlines(user) ? (
                      <input type="date" value={block.materialsAt ?? ""} onChange={(e) => setMaterialsAt(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-cyan-400" />
                    ) : (
                      <p className="font-medium text-slate-700">{block.materialsAt ? fmtDate(block.materialsAt) : "—"}</p>
                    )}
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">Preenche sozinha quando o bloco entra em "Arquivos em Revisão".</p>
                  </div>
                )}
                {block.published && <div><p className="text-xs text-slate-400">Publicado em</p><p className="font-medium text-slate-700">{fmtDate(block.published)}</p></div>}
                <div>
                  <p className="text-xs text-slate-400">Revisões utilizadas</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {[...Array(MAX_REVISIONS)].map((_, i) => (
                        <div key={i} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${i < revisions ? (revisionLimitReached ? "bg-red-500 border-red-500 text-white" : "bg-amber-400 border-amber-400 text-white") : "border-slate-300 text-slate-300"}`}>{i + 1}</div>
                      ))}
                    </div>
                    <span className={`text-xs font-semibold ${revisionLimitReached ? "text-red-600" : revisionWarning ? "text-amber-600" : "text-slate-500"}`}>
                      {revisionLimitReached ? "Limite atingido" : `${revisions}/${MAX_REVISIONS}`}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
            {/* Aviso de revisão */}
            {isClient && revisionWarning && !revisionLimitReached && (
              <Card className="p-4 border-l-4 border-l-amber-400 bg-amber-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Atenção: última revisão gratuita</p>
                    <p className="text-xs text-amber-700 mt-0.5">Você utilizou {revisions} de {MAX_REVISIONS} revisões incluídas. A próxima rejeição gerará um custo adicional conforme contrato.</p>
                  </div>
                </div>
              </Card>
            )}
            {isClient && revisionLimitReached && (
              <Card className="p-4 border-l-4 border-l-red-400 bg-red-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Limite de revisões atingido</p>
                    <p className="text-xs text-red-700 mt-0.5">As {MAX_REVISIONS} revisões gratuitas foram utilizadas. Novas solicitações de revisão estão sujeitas a cobrança adicional. Entre em contato com info@archtechtour.com.</p>
                  </div>
                </div>
              </Card>
            )}
            {!isClient && special(user, "transition") && validNext.length > 0 && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Transições Disponíveis</h3>
                <div className="flex flex-wrap gap-2">
                  {validNext.map((ns) => (
                    <button key={ns} onClick={() => handleTransition(ns)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm active:scale-95 ${STATUS_COLORS[ns]}`}>
                      → {STATUS_LABELS[ns]}
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Completude</h3>
              <div className="flex items-center gap-3 mb-3"><ProgressBar value={readiness.percentage} className="flex-1" /><span className="text-sm font-bold text-slate-700">{readiness.percentage}%</span></div>
              <div className="space-y-1.5">
                {readiness.required.map((cat) => {
                  const has = readiness.present.includes(cat);
                  return (<div key={cat} className="flex items-center gap-2 text-xs">{has ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-red-400" />}<span className={has ? "text-slate-600" : "text-red-500 font-medium"}>{CATEGORY_LABELS[cat]}</span></div>);
                })}
              </div>
              {!readiness.complete && <p className="text-xs text-amber-600 mt-3 bg-amber-50 p-2 rounded-lg">Materiais incompletos para este tipo de serviço.</p>}
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Atividade</h3>
              <div className="space-y-2">
                {blockActivities.slice(0, 5).map((act) => (
                  <div key={act.id} className="flex items-start gap-2 text-xs"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" /><div><p className="text-slate-600">{act.desc}</p><p className="text-slate-400">{isClient ? fmtDateTime(act.at) : `${actorName(act)} · ${fmtDateTime(act.at)}`}</p></div></div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "assets" && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Arquivos ({blockAssets.length})</h3>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Upload
            </button>
          </div>
          {blockAssets.length === 0 ? (
            <div onClick={() => setShowUpload(true)} className="cursor-pointer hover:bg-slate-50 rounded-xl transition-colors">
              <EmptyState icon={FileUp} title="Nenhum arquivo enviado" desc="Clique em Upload ou aqui para enviar materiais." />
            </div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((cat) => {
                const catAssets = blockAssets.filter((a) => a.cat === cat);
                if (!catAssets.length) return null;
                return (
                  <div key={cat} className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{CATEGORY_LABELS[cat]}</p>
                    </div>
                    {catAssets.map((a) => (
                      <AssetRow key={a.id} asset={a} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {showEdit && <BlockEditModal initial={block} onClose={() => setShowEdit(false)} onSave={handleEditSave} />}
      {showUpload && (
        <UploadModal
          blockId={block.id}
          clientId={block.clientId}
          allowedCategories={Object.keys(CATEGORY_LABELS) as AssetCategory[]}
          onClose={() => setShowUpload(false)}
          onUploaded={(asset) => {
            // Functional updates avoid stale-closure bugs when multiple files are uploaded in sequence
            setAssets((prev) => [...prev, asset]);
            logActivity({ type: "asset_uploaded", entity: "assets", blockId: block.id, clientId: block.clientId, entityId: asset.id, desc: `Arquivo enviado: ${asset.name} (${CATEGORY_LABELS[asset.cat]})` })
              .then((a) => { if (a) setActivities((prev) => [...prev, a]); });
          }}
        />
      )}

      {tab === "approvals" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Aprovações</h3>
          {!approvalRule && approvalHistory.length === 0 ? <EmptyState icon={CheckCircle} title="Nenhuma aprovação" desc="Quando o bloco entrar em validação de material ou final, a decisão aparece aqui." /> : (
            <div className="space-y-3">
              {approvalRule && (
                <div className="border rounded-lg p-4 border-amber-200 bg-amber-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{approvalRule.label}</span>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pendente</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Aguardando decisão do cliente{revisions > 0 ? ` · ${revisions}/${MAX_REVISIONS} revisões usadas` : ""}</p>
                  {isClient && (
                    <div className="space-y-2 mt-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleClientDecision("approve")} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700">
                          <ThumbsUp className="w-3.5 h-3.5" /> Aprovar
                        </button>
                        <button
                          onClick={() => handleClientDecision("reject")}
                          disabled={revisionLimitReached}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" /> Solicitar revisão {revisions < MAX_REVISIONS ? `(${MAX_REVISIONS - revisions} restantes)` : ""}
                        </button>
                      </div>
                      {revisionLimitReached && (
                        <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Revisões gratuitas esgotadas — contate info@archtechtour.com para solicitar revisão adicional.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {approvalHistory.map((act) => {
                const approved = act.type === "approval_approved";
                return (
                  <div key={act.id} className={`border rounded-lg p-4 ${approved ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{act.desc}</span>
                      <Badge className={approved ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>{approved ? "Aprovado" : "Revisão"}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">{getUserName(act.userId)} · {fmtDate(act.at)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === "finishes" && <BlockFinishesTab block={block} user={user} setPage={setPage} />}

      {tab === "activity" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Timeline</h3>
          {blockActivities.length === 0 ? <EmptyState icon={Activity} title="Sem atividade" /> : (
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
              {blockActivities.map((act) => (
                <div key={act.id} className="relative"><div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" /><p className="text-sm text-slate-700">{act.desc}</p><p className="text-xs text-slate-400 mt-0.5">{actorName(act)} · {fmtDateTime(act.at)}</p></div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "publication" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Publicação</h3>
          {publication ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><Badge className="bg-green-100 text-green-700 border-green-200">{publication.env}</Badge><Badge className="bg-slate-100 text-slate-600 border-slate-200">v{publication.v}</Badge></div>
              <div><p className="text-xs text-slate-400 mb-1">URL</p><a href={publication.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">{publication.url} <ExternalLink className="w-3 h-3" /></a></div>
              <div>
                <div className="flex items-center justify-between mb-1"><p className="text-xs text-slate-400">Código Embed</p><button onClick={copyEmbed} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? "Copiado!" : "Copiar"}</button></div>
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{publication.embed}</pre>
              </div>
            </div>
          ) : (
            <EmptyState icon={Globe} title="Ainda não publicado" desc={block.status === "approved" ? "Bloco aprovado — pronto para publicação." : "O bloco precisa ser aprovado primeiro."} />
          )}
        </Card>
      )}
    </div>
  );
}

// ============================================================
// REMAINING PAGES (Contracts, Clients, Approvals, Queue, Activity, Users)
// ============================================================
function ContractFormModal({ title, onClose, onSave, initial, clients }: {
  title: string; onClose: () => void;
  onSave: (d: { id?: string; clientId: string; title: string; totalBlocks: number; usedBlocks: number; startDate: string; active: boolean }) => void;
  initial?: SeedContract; clients: SeedClient[];
}) {
  const { blocks } = useContext(AppContext);
  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?.id ?? "");
  const [t, setT] = useState(initial?.title ?? "");
  const [tb, setTb] = useState(String(initial?.totalBlocks ?? 10));
  // Utilizados não é campo editável: é a contagem real dos blocos do contrato.
  const ub = initial ? usedBlocksOf(initial.id, blocks) : 0;
  const [sd, setSd] = useState(initial?.startDate ?? new Date().toISOString().slice(0, 10));
  const [active, setActive] = useState(initial?.active ?? true);
  const canSave = t.trim() && clientId && Number(tb) > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-slate-500">Cliente *</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
              {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-medium text-slate-500">Título *</label><input value={t} onChange={(e) => setT(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Ex: Contrato 2026 – Linha Completa" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500">Total Blocos *</label><input type="number" value={tb} onChange={(e) => setTb(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div><label className="text-xs font-medium text-slate-500">Já Utilizados</label><div className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600">{ub} <span className="text-xs text-slate-400">(contagem real dos blocos)</span></div></div>
          </div>
          <div><label className="text-xs font-medium text-slate-500">Data de Início</label><input type="date" value={sd} onChange={(e) => setSd(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onSave({ id: initial?.id, clientId, title: t.trim(), totalBlocks: Number(tb), usedBlocks: Number(ub), startDate: sd, active })} disabled={!canSave} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-30 hover:bg-slate-800">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ContractsPage({ user, setPage, setSelectedContract }: { user: SeedUser; setPage: (p: string) => void; setSelectedContract: (id: string) => void }) {
  const { contracts, setContracts, clients, currentUser, blocks } = useContext(AppContext);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SeedContract | null>(null);
  // Permissões vêm do perfil de acesso (src/lib/access.ts).
  const canCreate = can(currentUser, "contracts", "create");
  const canEdit = can(currentUser, "contracts", "edit");
  const canDelete = can(currentUser, "contracts", "delete");
  const ctrs = user.role === "client" ? contracts.filter((c) => c.clientId === user.clientId) : contracts;

  const handleSave = (d: { id?: string; clientId: string; title: string; totalBlocks: number; usedBlocks: number; startDate: string; active: boolean }) => {
    if (d.id) {
      setContracts(contracts.map((c) => c.id === d.id ? { ...c, ...d, id: d.id } : c));
    } else {
      setContracts([...contracts, { ...d, id: `ct_${Date.now()}` }]);
    }
    setShowAdd(false); setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold text-slate-800">Contratos</h1><p className="text-sm text-slate-500">{ctrs.length} contratos</p></div>
        {canCreate && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"><Plus className="w-3.5 h-3.5" /> Novo Contrato</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ctrs.map((ct) => {
          const cl = clients.find((c) => c.id === ct.clientId);
          const usedReal = usedBlocksOf(ct.id, blocks);
          const pct = ct.totalBlocks > 0 ? Math.round((usedReal / ct.totalBlocks) * 100) : 0;
          return (
            <Card key={ct.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div onClick={() => { setSelectedContract(ct.id); setPage("contract_detail"); }} className="cursor-pointer flex-1">
                  <p className="text-sm font-semibold text-slate-800">{ct.title}</p>
                  {user.role !== "client" && <p className="text-xs text-slate-400 mt-0.5">{cl?.name}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ct.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}>{ct.active ? "Ativo" : "Inativo"}</Badge>
                  {canEdit && <button onClick={() => setEditing(ct)} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100"><Settings className="w-3.5 h-3.5 text-slate-400" /></button>}
                </div>
              </div>
              <div onClick={() => { setSelectedContract(ct.id); setPage("contract_detail"); }} className="cursor-pointer">
                <div className="flex items-center justify-between text-sm mb-2"><span className="text-slate-500">{usedReal} / {ct.totalBlocks} blocos</span><span className="font-bold text-slate-700">{pct}%</span></div>
                <ProgressBar value={pct} />
                <p className="text-xs text-slate-400 mt-3">Início: {fmtDate(ct.startDate)}</p>
              </div>
            </Card>
          );
        })}
      </div>
      {showAdd && <ContractFormModal title="Novo Contrato" onClose={() => setShowAdd(false)} onSave={handleSave} clients={clients} />}
      {editing && <ContractFormModal title="Editar Contrato" onClose={() => setEditing(null)} onSave={handleSave} initial={editing} clients={clients} />}
    </div>
  );
}

function ContractDetailPage({ contractId, user, setPage, setSelectedBlock }: { contractId: string; user: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void }) {
  const { blocks } = useContext(AppContext);
  const ct = CONTRACTS.find((c) => c.id === contractId);
  if (!ct) return <EmptyState icon={FileText} title="Contrato não encontrado" />;
  const cl = CLIENTS.find((c) => c.id === ct.clientId);
  const ctBlocks = blocks.filter((b) => b.contractId === ct.id);
  const usedReal = ctBlocks.length;
  return (
    <div className="space-y-4">
      <button onClick={() => setPage("contracts")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div><h1 className="text-xl font-bold text-slate-800">{ct.title}</h1><p className="text-sm text-slate-500">{cl?.name} · Início: {fmtDate(ct.startDate)}</p></div>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard icon={FileText} label="Contratados" value={ct.totalBlocks} />
        <MetricCard icon={Package} label="Utilizados" value={usedReal} />
        <MetricCard icon={Box} label="Disponíveis" value={ct.totalBlocks - usedReal} color="text-emerald-600" />
      </div>
      <Card>
        <div className="p-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-700">Blocos ({ctBlocks.length})</h3></div>
        <DataTable data={ctBlocks} onRowClick={(row) => { setSelectedBlock(row.id); setPage("block_detail"); }} columns={[
          { label: "#", render: (r: SeedBlock) => <span className="font-mono text-xs text-slate-400">{r.n}</span> },
          { label: "Título", render: (r: SeedBlock) => <p className="font-medium text-slate-800 text-sm">{r.title}</p> },
          { label: "Tipo", render: (r: SeedBlock) => <ServiceBadge type={r.svc} /> },
          { label: "Status", render: (r: SeedBlock) => <StatusBadge status={r.status} /> },
          { label: "Prioridade", render: (r: SeedBlock) => <PriorityDot priority={r.pri} /> },
        ]} />
      </Card>
    </div>
  );
}

function ClientFormModal({ title, onClose, onSave, initial }: {
  title: string; onClose: () => void;
  onSave: (d: { id?: string; name: string; code: string; contactEmail: string; active: boolean }) => void;
  initial?: SeedClient;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [contactEmail, setEmail] = useState(initial?.contactEmail ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const canSave = name.trim() && code.trim();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-slate-500">Nome *</label><input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Ex: Tidelli" /></div>
          <div><label className="text-xs font-medium text-slate-500">Code (alias para analytics — lowercase) *</label><input value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono" placeholder="tidelli" /></div>
          <div><label className="text-xs font-medium text-slate-500">E-mail de contato</label><input value={contactEmail} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="contato@empresa.com.br" /></div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onSave({ id: initial?.id, name: name.trim(), code: code.trim(), contactEmail: contactEmail.trim(), active })} disabled={!canSave} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-30 hover:bg-slate-800">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ClientsPage() {
  const { clients, setClients, contracts, blocks, currentUser } = useContext(AppContext);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SeedClient | null>(null);
  // Permissões vêm do perfil de acesso (src/lib/access.ts).
  const canCreate = can(currentUser, "clients", "create");
  const canEdit = can(currentUser, "clients", "edit");
  const canDelete = can(currentUser, "clients", "delete");

  const handleSave = (d: { id?: string; name: string; code: string; contactEmail: string; active: boolean }) => {
    if (d.id) {
      setClients(clients.map((c) => c.id === d.id ? { ...c, name: d.name, code: d.code, contactEmail: d.contactEmail, active: d.active } : c));
    } else {
      setClients([...clients, { id: `c_${Date.now()}`, name: d.name, code: d.code, contactEmail: d.contactEmail, active: d.active }]);
    }
    setShowAdd(false); setEditing(null);
  };
  const toggleActive = (id: string) => setClients(clients.map((c) => c.id === id ? { ...c, active: !c.active } : c));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold text-slate-800">Clientes</h1><p className="text-sm text-slate-500">{clients.length} clientes · {clients.filter((c) => c.active).length} ativos</p></div>
        {canCreate && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"><Plus className="w-3.5 h-3.5" /> Novo Cliente</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clients.map((cl) => {
          const ctrs = contracts.filter((c) => c.clientId === cl.id);
          const total = ctrs.reduce((s, c) => s + c.totalBlocks, 0);
          const used = ctrs.reduce((s, c) => s + usedBlocksOf(c.id, blocks), 0);
          const cnt = blocks.filter((b) => b.clientId === cl.id).length;
          return (
            <Card key={cl.id} className={`p-5 ${!cl.active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">{cl.code.slice(0, 2).toUpperCase()}</div>
                  <div><p className="text-sm font-semibold text-slate-800">{cl.name}</p><p className="text-xs text-slate-400 font-mono">{cl.code}</p></div>
                </div>
                {(canEdit || canDelete) && (
                  <div className="flex gap-1">
                    {canEdit && <button onClick={() => setEditing(cl)} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100"><Settings className="w-3.5 h-3.5 text-slate-400" /></button>}
                    {canDelete && <button onClick={() => toggleActive(cl.id)} title={cl.active ? "Desativar" : "Reativar"} className="p-1.5 rounded-lg hover:bg-slate-100">{cl.active ? <X className="w-3.5 h-3.5 text-red-500" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}</button>}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-lg font-bold text-slate-700">{ctrs.length}</p><p className="text-xs text-slate-400">Contratos</p></div>
                <div><p className="text-lg font-bold text-slate-700">{cnt}</p><p className="text-xs text-slate-400">Blocos</p></div>
                <div><p className="text-lg font-bold text-emerald-600">{total - used}</p><p className="text-xs text-slate-400">Disponíveis</p></div>
              </div>
              <p className="text-xs text-slate-400 mt-3">{cl.contactEmail || "—"}</p>
            </Card>
          );
        })}
      </div>
      {showAdd && <ClientFormModal title="Novo Cliente" onClose={() => setShowAdd(false)} onSave={handleSave} />}
      {editing && <ClientFormModal title="Editar Cliente" onClose={() => setEditing(null)} onSave={handleSave} initial={editing} />}
    </div>
  );
}

function ApprovalsPage({ user }: { user: SeedUser }) {
  // Sem tabela de aprovações: pendente = bloco parado esperando o cliente;
  // resolvida = registro de aprovação/revisão no log de atividades. É o mesmo
  // critério do dashboard e do badge da sidebar — os três sempre batem.
  const isClient = user.role === "client";
  const [tab, setTab] = useState("pending");
  const { blocks, setBlocks, setTickets, activities, clients } = useContext(AppContext);
  const scope = isClient ? blocks.filter((b) => b.clientId === user.clientId) : blocks;
  const pending = scope.filter(isAwaitingClient).sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  const scopeIds = new Set(scope.map((b) => b.id));
  const resolved = activities
    .filter((a) => (a.type === "approval_approved" || a.type === "approval_rejected") && scopeIds.has(a.blockId))
    .sort((a, b) => b.at.localeCompare(a.at));

  const decide = (block: SeedBlock, action: "approve" | "reject") => {
    const rule = APPROVAL_NEXT[block.status];
    if (!rule) return;
    const revisions = block.clientRevisions ?? 0;
    if (action === "reject" && revisions >= MAX_CLIENT_REVISIONS) return;
    const next = action === "approve" ? rule.approve : rule.reject;
    const updated = withStatus(block, next, action === "reject" ? { clientRevisions: revisions + 1 } : {});
    setBlocks(blocks.map((b) => (b.id === block.id ? updated : b))); // o servidor registra aprovação/revisão do cliente ao gravar
    setTickets((prev) => syncTicketsWithBlock(prev, updated));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Aprovações</h1>
      <div className="flex gap-2"><TabBtn active={tab === "pending"} label="Pendentes" count={pending.length} onClick={() => setTab("pending")} /><TabBtn active={tab === "resolved"} label="Resolvidas" count={resolved.length} onClick={() => setTab("resolved")} /></div>

      {tab === "pending" && (
        <div className="space-y-3">
          {pending.length === 0 ? <Card className="p-8"><EmptyState icon={CheckCircle} title="Nenhuma aprovação pendente" desc="Quando um bloco entrar em validação de material ou validação final, ele aparece aqui." /></Card> : pending.map((block) => {
            const rule = APPROVAL_NEXT[block.status]!;
            const revisions = block.clientRevisions ?? 0;
            const limitReached = revisions >= MAX_CLIENT_REVISIONS;
            const client = clients.find((c) => c.id === block.clientId);
            return (
              <Card key={block.id} className="p-5 border-l-4 border-l-amber-400">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{block.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{rule.label} · {block.sku}{!isClient && client ? ` · ${client.name}` : ""}</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pendente</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-2">Aguardando desde a última mudança de status{revisions > 0 ? ` · ${revisions} revisão${revisions > 1 ? "ões" : ""} já solicitada${revisions > 1 ? "s" : ""}` : ""}</p>
                {isClient ? (
                  <div className="space-y-2 mt-3">
                    <div className="flex gap-2">
                      <button onClick={() => decide(block, "approve")} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"><ThumbsUp className="w-3.5 h-3.5" /> Aprovar</button>
                      <button onClick={() => decide(block, "reject")} disabled={limitReached} className="flex items-center gap-1 px-4 py-2 bg-white text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"><ThumbsDown className="w-3.5 h-3.5" /> Solicitar revisão {!limitReached ? `(${MAX_CLIENT_REVISIONS - revisions} restantes)` : ""}</button>
                    </div>
                    {limitReached && <p className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Revisões gratuitas esgotadas — contate info@archtechtour.com para solicitar revisão adicional.</p>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-3">O cliente decide aqui ou no detalhe do bloco. Para registrar uma aprovação recebida por fora, mude o status no detalhe do bloco.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "resolved" && (
        <div className="space-y-3">
          {resolved.length === 0 ? <Card className="p-8"><EmptyState icon={CheckCircle} title="Nenhuma resolvida" desc="Aprovações e pedidos de revisão feitos pelo cliente ficam registrados aqui." /></Card> : resolved.map((act) => {
            const block = blocks.find((b) => b.id === act.blockId);
            const approved = act.type === "approval_approved";
            return (
              <Card key={act.id} className={`p-5 border-l-4 ${approved ? "border-l-green-400" : "border-l-red-400"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-semibold text-slate-800">{block?.title || "—"}</p><p className="text-xs text-slate-400 mt-0.5">{act.desc}{block?.sku ? ` · ${block.sku}` : ""}</p></div>
                  <Badge className={approved ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>{approved ? "Aprovado" : "Revisão"}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-2">{getUserName(act.userId)} em {fmtDate(act.at)}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QueuePage({ user, setPage, setSelectedBlock }: { user: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void }) {
  const { blocks } = useContext(AppContext);
  const [view, setView] = useState("my");
  const views: Record<string, { label: string; data: SeedBlock[] }> = {
    my: { label: "Meus Itens", data: blocks.filter((b) => b.owner === user.id) },
    backup: { label: "Meu Backup", data: blocks.filter((b) => b.backup === user.id) },
    unassigned: { label: "Sem Responsável", data: blocks.filter((b) => !b.owner && !["draft", "archived", "published"].includes(b.status)) },
    blocked: { label: "Bloqueados", data: blocks.filter((b) => b.status === "blocked") },
    awaiting: { label: "Aguardando Cliente", data: blocks.filter((b) => ["awaiting_client_files", "awaiting_client_material_validation", "awaiting_client_final_validation"].includes(b.status)) },
  };
  const current = views[view];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Fila de Trabalho</h1>
      <div className="flex gap-2 flex-wrap">{Object.entries(views).map(([k, v]) => <TabBtn key={k} active={view === k} label={v.label} count={v.data.length} onClick={() => setView(k)} />)}</div>
      <Card>
        <DataTable data={current.data} onRowClick={(row) => { setSelectedBlock(row.id); setPage("block_detail"); }} columns={[
          { label: "SKU", render: (r: SeedBlock) => <span className="font-mono text-xs">{r.sku}</span> },
          { label: "Título", render: (r: SeedBlock) => <p className="text-sm font-medium text-slate-800">{r.title}</p> },
          { label: "Cliente", render: (r: SeedBlock) => <span className="text-xs">{getClientCode(r.clientId)}</span> },
          { label: "Status", render: (r: SeedBlock) => <StatusBadge status={r.status} /> },
          { label: "Prioridade", render: (r: SeedBlock) => <PriorityDot priority={r.pri} /> },
          { label: "Tipo", render: (r: SeedBlock) => <ServiceBadge type={r.svc} /> },
        ]} />
      </Card>
    </div>
  );
}

function ActivityPage({ setPage, setSelectedBlock, setSelectedContract }: { setPage: (p: string) => void; setSelectedBlock: (id: string) => void; setSelectedContract: (id: string) => void }) {
  const { users, blocks, clients } = useContext(AppContext);
  const nav: ActivityNav = { setPage, setSelectedBlock, setSelectedContract };
  const [days, setDays] = useState(30);
  const [items, setItems] = useState<SeedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [person, setPerson] = useState("all");
  const [entity, setEntity] = useState("all");
  const [group, setGroup] = useState<"team" | "all">("team");
  const [q, setQ] = useState("");
  const [showNav, setShowNav] = useState(false);
  const [limit, setLimit] = useState(150);

  // Sempre lê do servidor (não do estado em memória): o que está aqui é o que está no banco.
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/activity?days=${days}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(j.items)) throw new Error(j.error || `HTTP ${r.status}`);
      setItems(j.items as SeedActivity[]);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const roleOf = (a: SeedActivity) => a.userRole || users.find((u) => u.id === a.userId)?.role || "";
  const entityOf = (a: SeedActivity) => a.entity || "blocks"; // registros antigos (pré set/2026) não têm entidade

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((a) =>
      (showNav || !isNavigation(a)) &&
      (person === "all" || a.userId === person) &&
      (entity === "all" || entityOf(a) === entity) &&
      (!needle || `${a.desc} ${actorName(a)} ${a.entityLabel ?? ""} ${blocks.find((b) => b.id === a.blockId)?.sku ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [items, person, entity, q, showNav, blocks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resumo por pessoa. Parte da lista de usuários (não do log): quem não tem
  // linha de atividade aparece com zero — é exatamente quem não está usando.
  type Row = { id: string; name: string; role: string; actions: number; views: number; logins: number; last: string };
  const summary = useMemo(() => {
    const map = new Map<string, Row>();
    users.filter((u) => u.active !== false).forEach((u) => map.set(u.id, { id: u.id, name: u.name, role: u.role, actions: 0, views: 0, logins: 0, last: "" }));
    items.forEach((a) => {
      let r = map.get(a.userId);
      if (!r) { r = { id: a.userId, name: actorName(a), role: roleOf(a), actions: 0, views: 0, logins: 0, last: "" }; map.set(a.userId, r); }
      if (a.type === "page_view") r.views++;
      else if (a.type === "login") r.logins++;
      else if (a.type !== "logout") r.actions++;
      if (a.at > r.last) r.last = a.at;
    });
    const isTeam = (r: Row) => r.role !== "client";
    return Array.from(map.values())
      .filter((r) => group === "all" || isTeam(r))
      .sort((x, y) => y.actions - x.actions || y.views - x.views || x.name.localeCompare(y.name));
  }, [items, users, group]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => ({
    actions: items.filter((a) => !isNavigation(a)).length,
    views: items.filter((a) => a.type === "page_view").length,
    people: new Set(items.map((a) => a.userId)).size,
    idle: summary.filter((r) => r.actions + r.views + r.logins === 0).length,
  }), [items, summary]);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["data_hora", "usuario", "perfil", "email", "tipo", "entidade", "descricao", "bloco_sku", "cliente"].join(";")];
    filtered.forEach((a) => rows.push([
      new Date(a.at).toLocaleString("pt-BR"), actorName(a), ROLE_LABELS[roleOf(a) as UserRole] ?? roleOf(a), a.userEmail ?? "",
      TYPE_LABELS[a.type] ?? a.type, ENTITY_LABELS[entityOf(a)] ?? entityOf(a), a.desc,
      blocks.find((b) => b.id === a.blockId)?.sku ?? "", clients.find((c) => c.id === a.clientId)?.name ?? "",
    ].map(esc).join(";")));
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a"); el.href = url; el.download = `atividade-portal-${new Date().toISOString().slice(0, 10)}.csv`; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const periodLabel = days === 0 ? "todo o histórico" : `últimos ${days} dias`;
  const selectCls = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30";
  const typeTone = (t: string) =>
    t === "login" || t === "logout" || t === "page_view" ? "bg-slate-100 text-slate-500 border-slate-200"
    : t.endsWith("_deleted") || t === "approval_rejected" ? "bg-rose-50 text-rose-700 border-rose-200"
    : t.endsWith("_created") || t === "approval_approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-cyan-50 text-cyan-700 border-cyan-200";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Atividade Global</h1>
          <p className="mt-1 text-sm text-slate-500">Tudo que foi feito no portal, registrado pelo servidor no momento da gravação · {periodLabel}.</p>
          <p className="mt-1 text-xs text-amber-700">Registro completo (logins, telas abertas, tickets, BIM, acabamentos, KB) só existe a partir de <b>14/09/2026 às 14:46</b>. Antes disso o portal gravava apenas edições e mudanças de status de blocos — quem só mexeu em tickets ou navegou aparece zerado no período anterior.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button>
          <button onClick={exportCsv} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><FileText className="h-4 w-4" /> Exportar CSV</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Ações registradas", value: totals.actions, hint: "criações, edições, status, aprovações, uploads…" },
          { label: "Telas abertas", value: totals.views, hint: "navegação dentro do portal" },
          { label: "Pessoas ativas", value: totals.people, hint: `com ao menos um registro (${periodLabel})` },
          { label: "Sem uso no período", value: totals.idle, hint: group === "team" ? "equipe e terceirizados sem nenhum registro" : "usuários sem nenhum registro", tone: totals.idle ? "text-rose-600" : "text-emerald-600" },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{k.label}</p>
            <p className={`mt-2 text-2xl font-bold ${k.tone ?? "text-slate-900"}`}>{loading ? "…" : k.value}</p>
            <p className="mt-1 text-xs text-slate-400">{k.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Uso por pessoa</h3>
            <p className="text-xs text-slate-400">Clique numa linha para ver só as atividades da pessoa. Linhas em vermelho não têm nenhum registro no período.</p>
          </div>
          <div className="flex gap-2">
            <TabBtn active={group === "team"} label="Equipe + terceirizados" onClick={() => setGroup("team")} />
            <TabBtn active={group === "all"} label="Todos (inclui clientes)" onClick={() => setGroup("all")} />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="py-2 pr-3 font-semibold">Pessoa</th><th className="py-2 pr-3 font-semibold">Perfil</th>
              <th className="py-2 pr-3 text-right font-semibold">Ações</th><th className="py-2 pr-3 text-right font-semibold">Telas</th>
              <th className="py-2 pr-3 text-right font-semibold">Logins</th><th className="py-2 font-semibold">Última atividade</th>
            </tr></thead>
            <tbody>
              {summary.map((r) => {
                const idle = r.actions + r.views + r.logins === 0;
                const selected = person === r.id;
                return (
                  <tr key={r.id} onClick={() => setPerson(selected ? "all" : r.id)} className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 ${selected ? "bg-cyan-50/60" : ""} ${idle ? "text-rose-600" : "text-slate-700"}`}>
                    <td className="py-2 pr-3 font-semibold">{r.name}</td>
                    <td className="py-2 pr-3 text-xs">{ROLE_LABELS[r.role as UserRole] ?? r.role ?? "—"}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.actions}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.views}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.logins}</td>
                    <td className="py-2 text-xs">{r.last ? fmtDateTime(r.last) : "nunca no período"}</td>
                  </tr>
                );
              })}
              {!summary.length && <tr><td colSpan={6} className="py-6 text-center text-slate-400">Nenhum usuário.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectCls}>
            <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={0}>Todo o histórico</option>
          </select>
          <select value={person} onChange={(e) => setPerson(e.target.value)} className={selectCls}>
            <option value="all">Todas as pessoas</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className={selectCls}>
            <option value="all">Todas as áreas</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na descrição, pessoa, SKU…" className={`${selectCls} w-full pl-9`} />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showNav} onChange={(e) => setShowNav(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Mostrar navegação (telas abertas, login, logout)
          </label>
        </div>

        {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Não foi possível carregar o log: {error}</p>}
        <p className="mt-4 text-xs text-slate-400">{filtered.length} registro(s){person !== "all" ? ` · ${users.find((u) => u.id === person)?.name ?? person}` : ""}</p>

        {!loading && !filtered.length && !error ? <EmptyState icon={Activity} title="Nenhuma atividade com esses filtros" /> : (
          <div className="relative mt-3 space-y-4 pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
            {filtered.slice(0, limit).map((act) => {
              const block = blocks.find((b) => b.id === act.blockId);
              const client = clients.find((c) => c.id === act.clientId);
              const target = activityTarget(act, blocks, nav);
              return (
                <div key={act.id} className={`relative rounded-xl -mx-2 px-2 py-1 transition ${target ? "cursor-pointer hover:bg-slate-50" : ""}`} onClick={target?.go} title={target?.label}>
                  <div className={`absolute -left-[9px] top-2.5 h-2.5 w-2.5 rounded-full border-2 bg-white ${isNavigation(act) ? "border-slate-200" : "border-cyan-400"}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeTone(act.type)}`}>{TYPE_LABELS[act.type] ?? ENTITY_LABELS[entityOf(act)] ?? act.type}</span>
                    <p className="text-sm text-slate-700">{act.desc}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    <span className="font-semibold text-slate-500">{actorName(act)}</span>
                    {roleOf(act) ? ` · ${ROLE_LABELS[roleOf(act) as UserRole] ?? roleOf(act)}` : ""}
                    {` · ${ENTITY_LABELS[entityOf(act)] ?? entityOf(act)}`}
                    {block?.sku ? <> · <span className="font-mono">{block.sku}</span></> : null}
                    {client ? ` · ${client.name}` : ""}
                    {` · ${fmtDateTime(act.at)}`}
                    {act.sessionEmail && act.sessionEmail !== act.userEmail ? ` · sessão ${act.sessionEmail}` : ""}
                    {target && <> · <span className="font-semibold text-cyan-700 hover:underline">{target.label} →</span></>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {filtered.length > limit && (
          <button onClick={() => setLimit((n) => n + 150)} className="mt-5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300">Mostrar mais ({filtered.length - limit} restantes)</button>
        )}
      </Card>
    </div>
  );
}

type UserFormData = { name: string; email: string; role: UserRole; profileId?: string; clientId: string; password: string; allowedPages?: string[] };

function UserFormModal({
  title, onClose, onSave, initial,
}: {
  title: string;
  onClose: () => void;
  onSave: (data: UserFormData) => void;
  initial?: SeedUser;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  // O perfil de acesso escolhido define também o tipo de conta (role = base do perfil).
  const { profiles } = useContext(AppContext);
  const [profileId, setProfileId] = useState<string>(() => (initial ? profileOf(initial, profiles).id : defaultProfileId("internal_ops")));
  const chosen = profiles.find((p) => p.id === profileId) ?? profiles[0];
  const role: UserRole = chosen.base;
  // Cliente: usa as telas do perfil, a não ser que este usuário tenha exceção marcada à mão.
  const [usarPerfil, setUsarPerfil] = useState(!(initial?.allowedPages?.length));
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [showPw, setShowPw] = useState(false);
  const [acessoTotal, setAcessoTotal] = useState(initial?.allowedPages?.includes("all") ?? false);
  const [paginas, setPaginas] = useState<string[]>(
    initial?.allowedPages?.filter((p) => p !== "all") ?? PAGINAS_PADRAO_CLIENTE
  );
  const alternarPagina = (id: string) =>
    setPaginas((atual) => (atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id]));

  const isEdit = !!initial;
  const canSave = name.trim() && email.trim() && (!isEdit || password.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@archtechtour.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {isEdit ? "Nova Senha" : "Senha *"}
              {isEdit && <span className="text-slate-400 font-normal ml-1">(obrigatório para salvar)</span>}
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Digite a nova senha..." : "Senha de acesso"}
                className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw
                  ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                  : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Perfil de acesso</label>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
              <optgroup label="Perfis padrão">{profiles.filter((p) => p.system).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
              {profiles.some((p) => !p.system) && <optgroup label="Personalizados">{profiles.filter((p) => !p.system).map((p) => <option key={p.id} value={p.id}>{p.name} · tipo {BASE_LABELS[p.base]}</option>)}</optgroup>}
            </select>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{summarizeProfile(chosen)}. Permissões em <b>Perfis de acesso</b>.</p>
          </div>
          {role === "client" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                  <option value="">Selecione...</option>
                  {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <label className="block text-xs font-medium text-slate-500 mb-2">Telas liberadas</label>
                <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                  <input type="checkbox" checked={usarPerfil} onChange={(e) => setUsarPerfil(e.target.checked)} />
                  <span className="font-medium">Usar as telas do perfil</span>
                  <span className="text-xs text-slate-400">(desmarque para uma exceção só deste usuário)</span>
                </label>
                {!usarPerfil && <>
                <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                  <input type="checkbox" checked={acessoTotal} onChange={(e) => setAcessoTotal(e.target.checked)} />
                  <span className="font-medium">Acesso total</span>
                  <span className="text-xs text-slate-400">(todas as telas do portal)</span>
                </label>
                {!acessoTotal && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-1">
                    {PAGINAS_CLIENTE.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={paginas.includes(p.id)} onChange={() => alternarPagina(p.id)} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                )}
                {!acessoTotal && paginas.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    Nada marcado — o usuário vai cair nas telas do perfil.
                  </p>
                )}
                </>}
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={() => onSave({
            name: name.trim(), email: email.trim(), role, clientId, password,
            // Perfil padrão do tipo de conta não precisa ficar gravado no usuário.
            profileId: profileId === defaultProfileId(role) ? undefined : profileId,
            allowedPages: role === "client" && !usarPerfil ? (acessoTotal ? ["all"] : paginas) : undefined,
          })}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40">
            {isEdit ? "Salvar Alterações" : "Criar Usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersPage() {
  // Usa o estado do AppContext — NÃO criar estado local aqui. Só o `users` do
  // contexto dispara o efeito que espelha o array de módulo USERS e persiste no
  // DynamoDB; um useState local fica só na tela e o usuário some no reload.
  const { currentUser, users, setUsers, profiles, clients } = useContext(AppContext);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<SeedUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const canCreate = can(currentUser, "users", "create");
  const canEdit = can(currentUser, "users", "edit");
  const canDelete = can(currentUser, "users", "delete");

  // Filtros — 45+ cadastros já não cabem numa rolagem só.
  const [q, setQ] = useState("");
  const [fProfile, setFProfile] = useState("all");
  const [fClient, setFClient] = useState("all");
  const [fGroup, setFGroup] = useState<"all" | "team" | "clients" | "freelancers">("all");
  const [sortBy, setSortBy] = useState<"name" | "profile" | "client">("name");
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filteredUsers = useMemo(() => {
    const term = norm(q.trim());
    const list = users.filter((u) => {
      if (term && !norm(`${u.name} ${u.email} ${u.clientId ? getClientName(u.clientId) : ""}`).includes(term)) return false;
      if (fProfile !== "all" && profileOf(u, profiles).id !== fProfile) return false;
      if (fClient !== "all" && u.clientId !== fClient) return false;
      if (fGroup === "team" && (u.role === "client" || u.role === "freelancer_bim")) return false;
      if (fGroup === "clients" && u.role !== "client") return false;
      if (fGroup === "freelancers" && u.role !== "freelancer_bim") return false;
      return true;
    });
    const key = (u: SeedUser) => (sortBy === "profile" ? profileOf(u, profiles).name : sortBy === "client" ? (u.clientId ? getClientName(u.clientId) : "~") : "") + " " + u.name;
    return [...list].sort((a, b) => key(a).localeCompare(key(b), "pt-BR"));
  }, [users, profiles, q, fProfile, fClient, fGroup, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasFilters = !!q || fProfile !== "all" || fClient !== "all" || fGroup !== "all";
  const clientsWithUsers = clients.filter((c) => users.some((u) => u.clientId === c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const selCls = "text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

  const handleAdd = (data: UserFormData) => {
    const u: SeedUser = {
      id: `u_${Date.now()}`, name: data.name, email: data.email, password: data.password,
      role: data.role, active: true, ...(data.profileId ? { profileId: data.profileId } : {}), ...(data.role === "client" && data.clientId ? { clientId: data.clientId } : {}),
      ...(data.allowedPages?.length ? { allowedPages: data.allowedPages } : {}),
    };
    setUsers([...users, u]);
    setShowAdd(false);
  };

  const handleEdit = (data: UserFormData) => {
    if (!editingUser) return;
    setUsers(users.map((u) =>
      u.id === editingUser.id
        ? {
            ...u, name: data.name, email: data.email, role: data.role, password: data.password, profileId: data.profileId,
            clientId: data.role === "client" && data.clientId ? data.clientId : undefined,
            // Vazio = volta ao padrão (PAGINAS_PADRAO_CLIENTE); undefined em não-cliente.
            allowedPages: data.allowedPages?.length ? data.allowedPages : undefined,
          }
        : u
    ));
    setEditingUser(null);
  };

  const handleDelete = (id: string) => {
    setUsers(users.filter((u) => u.id !== id));
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Usuários</h1><p className="text-sm text-slate-500">{hasFilters ? `${filteredUsers.length} de ${users.length} registrados` : `${users.length} registrados`}</p></div>
        {canCreate && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"><Plus className="w-3.5 h-3.5" /> Novo Usuário</button>}
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou marca…" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" />
          </div>
          <select value={fGroup} onChange={(e) => setFGroup(e.target.value as typeof fGroup)} className={selCls}>
            <option value="all">Todos os tipos</option>
            <option value="team">Equipe interna</option>
            <option value="clients">Clientes</option>
            <option value="freelancers">Terceirizados</option>
          </select>
          <select value={fProfile} onChange={(e) => setFProfile(e.target.value)} className={selCls}>
            <option value="all">Todos os perfis</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={fClient} onChange={(e) => setFClient(e.target.value)} className={selCls}>
            <option value="all">Todas as marcas</option>
            {clientsWithUsers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={selCls} title="Ordenação">
            <option value="name">Ordem: nome</option>
            <option value="profile">Ordem: perfil</option>
            <option value="client">Ordem: marca</option>
          </select>
          {hasFilters && <button onClick={() => { setQ(""); setFProfile("all"); setFClient("all"); setFGroup("all"); }} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-1">Limpar filtros</button>}
        </div>
      </Card>
      <Card>
        <DataTable data={filteredUsers} columns={[
          { label: "Nome", render: (r: SeedUser) => <p className="text-sm font-medium text-slate-800">{r.name}</p> },
          { label: "Email", render: (r: SeedUser) => <span className="text-sm text-slate-500">{r.email}</span> },
          { label: "Perfil", render: (r: SeedUser) => {
            const pf = profileOf(r, profiles);
            return (
              <div>
                <Badge className={pf.base === "admin" ? "bg-purple-50 text-purple-700 border-purple-200" : pf.base === "client" ? "bg-blue-50 text-blue-600 border-blue-200" : pf.system ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-cyan-50 text-cyan-700 border-cyan-200"}>{pf.name}</Badge>
                {!pf.system && <p className="mt-1 text-[11px] text-slate-400">tipo {ROLE_LABELS[r.role]}</p>}
              </div>
            );
          } },
          { label: "Cliente", render: (r: SeedUser) => r.clientId ? getClientName(r.clientId) : "\u2014" },
          { label: "Acesso", render: (r: SeedUser) => {
            const ids = paginasPermitidas(r);
            const excecao = r.role === "client" && !!r.allowedPages?.length;
            const rotulos = ids.map((id) => ACCESS_MODULES.find((x) => x.id === id)?.label || id);
            return (
              <span className="text-xs text-slate-600" title={rotulos.join(", ")}>
                {rotulos.length <= 3 ? (rotulos.join(", ") || "Nenhum módulo") : `${rotulos.length} módulos`}
                {excecao && <span className="ml-1 text-amber-600">(exceção do usuário)</span>}
              </span>
            );
          } },
          { label: "Ações", render: (r: SeedUser) => confirmDelete === r.id ? (
            <div className="flex gap-1">
              <button onClick={() => handleDelete(r.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Confirmar</button>
              <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300">Cancelar</button>
            </div>
          ) : (
            <div className="flex gap-2">
              {canEdit && <button onClick={() => setEditingUser(r)} className="text-xs text-slate-500 hover:text-slate-800 hover:underline">Editar</button>}
              {canEdit && canDelete && <span className="text-slate-200">|</span>}
              {canDelete && r.id !== currentUser?.id && <button onClick={() => setConfirmDelete(r.id)} className="text-xs text-red-500 hover:text-red-700 hover:underline">Remover</button>}
              {!canEdit && !canDelete && <span className="text-xs text-slate-300">—</span>}
            </div>
          )},
        ]} />
      </Card>
      {showAdd && (
        <UserFormModal title="Novo Usuário" onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}
      {editingUser && (
        <UserFormModal title="Editar Usuário" onClose={() => setEditingUser(null)} onSave={handleEdit} initial={editingUser} />
      )}
    </div>
  );
}

// ============================================================
// FASE 4 — ONBOARDING WIZARD
// ============================================================
const SECTORS = ["Móveis", "Luminária e Iluminação", "Revestimentos", "Metais e Louças", "Design de Interiores", "Arquitetura", "Decoração", "Outro"];
const PRODUCT_CATEGORIES: Record<ProductCategory, string> = { moveis: "Móveis", luminarias: "Luminárias", revestimentos: "Revestimentos", metais: "Metais / Louças", outros: "Outros" };

function OnboardingWizardPage({ user, setPage, setSelectedBlock }: { user: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void }) {
  const clientId = user.clientId || "";
  const { blocks, setBlocks, assets } = useContext(AppContext);
  const [brands, setBrands] = useState<Brand[]>(BRANDS);
  const [catalog, setCatalog] = useState<CatalogProduct[]>(CATALOG);

  const brand = brands.find((b) => b.clientId === clientId) || { clientId, companyName: "", logoUrl: "", website: "", sector: "", priority: "normal" as Priority, step: 0 };
  const myProducts = catalog.filter((p) => p.clientId === clientId);
  const myBlocks = blocks.filter((b) => b.clientId === clientId);

  const [step, setStep] = useState(brand.step > 0 ? Math.min(brand.step, 4) : 0);
  const [form, setForm] = useState({ companyName: brand.companyName, logoUrl: brand.logoUrl || "", website: brand.website, sector: brand.sector, priority: brand.priority });
  const [newProd, setNewProd] = useState({ name: "", sku: "", category: "moveis" as ProductCategory });
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [varForm, setVarForm] = useState({ name: "", finishes: "", colors: "", materials: "" });

  const saveBrand = () => {
    const updated = brands.filter((b) => b.clientId !== clientId);
    const newBrand: Brand = { ...form, clientId, step: Math.max(1, brand.step) };
    setBrands([...updated, newBrand]);
    BRANDS = [...updated, newBrand];
    setStep(1);
  };

  const addProduct = () => {
    if (!newProd.name || !newProd.sku) return;
    const prod: CatalogProduct = { id: `cp${Date.now()}`, clientId, ...newProd, priority: myProducts.length + 1, variations: [] };
    const updated = [...catalog, prod];
    setCatalog(updated);
    CATALOG = updated;
    setNewProd({ name: "", sku: "", category: "moveis" });
  };

  const removeProduct = (id: string) => {
    const updated = catalog.filter((p) => p.id !== id);
    setCatalog(updated);
    CATALOG = updated;
  };

  const addVariation = (productId: string) => {
    if (!varForm.name) return;
    const updated = catalog.map((p) => p.id === productId ? { ...p, variations: [...p.variations, { id: `v${Date.now()}`, ...varForm }] } : p);
    setCatalog(updated);
    CATALOG = updated;
    setEditingVar(null);
    setVarForm({ name: "", finishes: "", colors: "", materials: "" });
  };

  // Auto-create SeedBlocks for each catalog product when moving to the file upload step
  const createBlocksFromCatalog = () => {
    const clientContracts = CONTRACTS.filter((c) => c.clientId === clientId);
    const contractId = clientContracts[0]?.id || "";
    const existingCskus = blocks.filter((b) => b.clientId === clientId).map((b) => b.csku);
    const currentCount = blocks.filter((b) => b.clientId === clientId).length;
    const newBlocks: SeedBlock[] = myProducts
      .filter((p) => !existingCskus.includes(p.sku))
      .map((p, i) => ({
        id: `pb_${Date.now()}_${i}`,
        clientId,
        contractId,
        n: currentCount + i + 1,
        sku: `${clientId.toUpperCase().slice(0, 6)}-${String(currentCount + i + 1).padStart(3, "0")}`,
        csku: p.sku,
        title: p.name,
        svc: "standard" as ServiceType,
        status: "awaiting_client_files" as BlockStatus,
        pri: "normal" as Priority,
        created: new Date().toISOString().slice(0, 10),
      }));
    if (newBlocks.length > 0) {
      setBlocks([...blocks, ...newBlocks]);
    }
  };

  const advanceStep = (n: number) => {
    if (n === 3) createBlocksFromCatalog();
    const updated = brands.map((b) => b.clientId === clientId ? { ...b, step: Math.max(b.step, n) } : b);
    setBrands(updated);
    BRANDS = updated;
    setStep(n);
  };

  // Checklist de completude
  const myBlockIds = myBlocks.map((b) => b.id);
  const hasCAD = assets.some((a) => myBlockIds.includes(a.blockId) && ["cad", "technical_drawing"].includes(a.cat));
  const hasPhotos = assets.some((a) => myBlockIds.includes(a.blockId) && ["reference_photo", "finishing"].includes(a.cat));
  const checks = [
    { label: "Dados da marca preenchidos", done: !!brand.companyName && !!brand.website && !!brand.sector },
    { label: "Catálogo com ao menos 1 produto", done: myProducts.length > 0 },
    { label: "Variações definidas em todos os produtos", done: myProducts.length > 0 && myProducts.every((p) => p.variations.length > 0) },
    { label: "Arquivos CAD enviados", done: hasCAD },
    { label: "Fotos de referência enviadas", done: hasPhotos },
  ];
  const completeness = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);

  const steps = ["Dados da Marca", "Catálogo de Produtos", "Variações", "Upload de Arquivos", "Completude"];

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Fase 4 · Onboarding" title="Configure sua presença digital" description="Preencha cada etapa para que nossa equipe possa iniciar a produção dos seus blocos 3D." />

      {/* Progress steps */}
      <Card className="p-6">
        <div className="flex items-center gap-2 overflow-x-auto">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <button onClick={() => setStep(i)} className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-4 py-3 text-center transition ${step === i ? "bg-slate-950 text-white" : i < step ? "bg-emerald-50 text-emerald-700" : "text-slate-400 hover:text-slate-600"}`}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step === i ? "bg-white/15 text-white" : i < step ? "bg-emerald-200 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className="text-[11px] font-semibold whitespace-nowrap">{s}</span>
              </button>
              {i < steps.length - 1 && <div className={`h-px flex-1 min-w-[24px] ${i < step ? "bg-emerald-300" : "bg-slate-200"}`} />}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Step 0 - Brand */}
      {step === 0 && (
        <Card className="p-6 md:p-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Dados da sua marca</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              { label: "Nome da empresa", key: "companyName", placeholder: "Ex: Escal Móveis" },
              { label: "Site", key: "website", placeholder: "Ex: www.escal.com.br" },
              { label: "Logo (URL)", key: "logoUrl", placeholder: "https://..." },
            ] as const).map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
                <input value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white transition" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Setor</label>
              <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition">
                <option value="">Selecione...</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Prioridade</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition">
                {(["low", "normal", "high", "urgent"] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={saveBrand} disabled={!form.companyName || !form.website || !form.sector} className="rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">
              Salvar e continuar →
            </button>
          </div>
        </Card>
      )}

      {/* Step 1 - Catalog */}
      {step === 1 && (
        <Card className="p-6 md:p-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Catálogo de produtos</h3>
          <p className="text-sm text-slate-500 mb-6">Liste todos os produtos que deseja transformar em blocos 3D. Informe nome e SKU.</p>
          <div className="flex flex-wrap gap-3 mb-4">
            <input value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} placeholder="Nome do produto" className="flex-1 min-w-[160px] rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 transition" />
            <input value={newProd.sku} onChange={(e) => setNewProd({ ...newProd, sku: e.target.value.toUpperCase() })} placeholder="SKU" className="w-40 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 transition" />
            <select value={newProd.category} onChange={(e) => setNewProd({ ...newProd, category: e.target.value as ProductCategory })} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm outline-none focus:border-cyan-400 transition">
              {Object.entries(PRODUCT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={addProduct} className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
          {myProducts.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum produto adicionado" desc="Adicione ao menos um produto para continuar." />
          ) : (
            <div className="space-y-2">
              {myProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-[11px] font-bold text-white">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.sku} · {PRODUCT_CATEGORIES[p.category]}</p>
                  </div>
                  <button onClick={() => removeProduct(p.id)} className="text-slate-400 hover:text-rose-500 transition"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-slate-700">← Voltar</button>
            <button onClick={() => advanceStep(2)} disabled={myProducts.length === 0} className="rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition">
              Continuar →
            </button>
          </div>
        </Card>
      )}

      {/* Step 2 - Variations */}
      {step === 2 && (
        <div className="space-y-4">
          {myProducts.length === 0 ? (
            <Card className="p-8"><EmptyState icon={Package} title="Nenhum produto no catálogo" desc="Volte ao passo anterior e adicione produtos primeiro." /></Card>
          ) : myProducts.map((p) => (
            <Card key={p.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{p.sku}</p>
                  <h4 className="text-base font-semibold text-slate-900">{p.name}</h4>
                </div>
                <button onClick={() => { setEditingVar(editingVar === p.id ? null : p.id); setVarForm({ name: "", finishes: "", colors: "", materials: "" }); }} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 transition">
                  <Plus className="h-3 w-3" /> Variação
                </button>
              </div>
              {p.variations.length === 0 && <p className="text-sm text-slate-400 italic">Nenhuma variação. Adicione ao menos uma.</p>}
              <div className="space-y-2 mb-3">
                {p.variations.map((v) => (
                  <div key={v.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-2">{v.name}</p>
                    <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
                      <div><span className="font-medium text-slate-700">Acabamentos:</span><br />{v.finishes || "—"}</div>
                      <div><span className="font-medium text-slate-700">Cores:</span><br />{v.colors || "—"}</div>
                      <div><span className="font-medium text-slate-700">Materiais:</span><br />{v.materials || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
              {editingVar === p.id && (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 space-y-3">
                  <p className="text-xs font-semibold text-cyan-800 uppercase tracking-wider">Nova variação</p>
                  <input value={varForm.name} onChange={(e) => setVarForm({ ...varForm, name: e.target.value })} placeholder="Nome da variação" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 transition" />
                  {(["finishes", "colors", "materials"] as const).map((field) => (
                    <input key={field} value={varForm[field]} onChange={(e) => setVarForm({ ...varForm, [field]: e.target.value })} placeholder={{ finishes: "Acabamentos (ex: Couro, Tecido)", colors: "Cores (ex: Bege, Cinza)", materials: "Materiais (ex: MDF, Aço)" }[field]} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 transition" />
                  ))}
                  <div className="flex gap-2">
                    <button onClick={() => addVariation(p.id)} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition">Salvar variação</button>
                    <button onClick={() => setEditingVar(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                  </div>
                </div>
              )}
            </Card>
          ))}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-700">← Voltar</button>
            <button onClick={() => advanceStep(3)} className="rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Continuar →</button>
          </div>
        </div>
      )}

      {/* Step 3 - Files */}
      {step === 3 && (
        <div className="space-y-4">
          <Card className="p-6 md:p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Upload de arquivos</h3>
            <p className="text-sm text-slate-500 mb-6">Seus produtos foram registrados como blocos. Clique em cada um para abrir e enviar os arquivos técnicos.</p>

            {/* Tipos aceitos */}
            <div className="grid gap-3 sm:grid-cols-3 mb-6">
              {[
                { cat: "CAD / Estrutural", exts: ".step, .dwg, .dxf, .iges", icon: FileUp, color: "text-violet-600 bg-violet-50 border-violet-200" },
                { cat: "Fotos de referência", exts: ".jpg, .jpeg, .png, .webp", icon: Eye, color: "text-sky-600 bg-sky-50 border-sky-200" },
                { cat: "Desenho técnico", exts: ".pdf, .dwg, .dxf", icon: Hash, color: "text-slate-600 bg-slate-50 border-slate-200" },
                { cat: "Acabamento / Material", exts: ".pdf, .png, .jpg", icon: FileText, color: "text-amber-600 bg-amber-50 border-amber-200" },
                { cat: "Bloco 3D existente", exts: ".glb, .gltf, .obj, .fbx", icon: Box, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                { cat: "Vídeo (opcional)", exts: ".mp4, .mov", icon: Globe, color: "text-rose-600 bg-rose-50 border-rose-200" },
              ].map((item) => (
                <div key={item.cat} className={`flex items-start gap-3 rounded-2xl border p-3 ${item.color}`}>
                  <item.icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">{item.cat}</p>
                    <p className="text-[11px] opacity-70 mt-0.5">{item.exts}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Blocks list */}
            {myBlocks.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-500">Nenhum bloco encontrado. Volte ao passo anterior e verifique se os produtos foram adicionados.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{myBlocks.length} bloco{myBlocks.length > 1 ? "s" : ""} aguardando arquivos</p>
                {myBlocks.map((block) => {
                  const blockAssets = assets.filter((a) => a.blockId === block.id);
                  const hasFiles = blockAssets.length > 0;
                  return (
                    <div key={block.id} className={`flex items-center justify-between rounded-[22px] border px-4 py-4 ${hasFiles ? "border-emerald-200/80 bg-emerald-50/60" : "border-amber-200/60 bg-amber-50/40"}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${hasFiles ? "bg-emerald-500 text-white" : "bg-amber-200 text-amber-700"}`}>
                          {hasFiles ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{block.title}</p>
                          <p className="text-xs text-slate-500">{block.csku} · {hasFiles ? `${blockAssets.length} arquivo${blockAssets.length > 1 ? "s" : ""} enviado${blockAssets.length > 1 ? "s" : ""}` : "Nenhum arquivo enviado"}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedBlock(block.id); setPage("block_detail"); }}
                        className="ml-4 flex-shrink-0 flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        Abrir bloco <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-700">← Voltar</button>
              <button onClick={() => advanceStep(4)} className="rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Ver checklist →</button>
            </div>
          </Card>
        </div>
      )}

      {/* Step 4 - Completeness */}
      {step === 4 && (
        <Card className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Checklist de completude</h3>
              <p className="text-sm text-slate-500 mt-1">Verifique se tudo está em ordem antes de iniciarmos a produção.</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-slate-900">{completeness}%</p>
              <p className="text-xs text-slate-500">completo</p>
            </div>
          </div>
          <ProgressBar value={completeness} className="mb-6" />
          <div className="space-y-3">
            {checks.map((c) => (
              <div key={c.label} className={`flex items-center gap-3 rounded-2xl border p-4 ${c.done ? "border-emerald-200/80 bg-emerald-50/60" : "border-amber-200/80 bg-amber-50/60"}`}>
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${c.done ? "bg-emerald-500 text-white" : "bg-amber-200 text-amber-700"}`}>
                  {c.done ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <p className={`text-sm font-semibold ${c.done ? "text-emerald-800" : "text-amber-800"}`}>{c.label}</p>
                {!c.done && <span className="ml-auto text-xs font-medium text-amber-600">Pendente</span>}
              </div>
            ))}
          </div>
          {completeness === 100 && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-800">Onboarding completo! Nossa equipe foi notificada e iniciará a produção em breve.</p>
            </div>
          )}
          <div className="mt-6 flex justify-start">
            <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-700">← Voltar</button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// FASE 5 — TICKETS DE PRODUÇÃO
// ============================================================
const TICKET_STATUS_LABELS = SHARED_TICKET_STATUS_LABELS as Record<TicketStatus, string>;
const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  new: "border-slate-200/80 bg-slate-100/90 text-slate-600",
  in_production: "border-violet-200/80 bg-violet-50 text-violet-700",
  internal_review: "border-amber-200/80 bg-amber-50 text-amber-700",
  delivered: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
};

/** Criar ticket ou, com `initial`, editar um existente (título, bloco, prazo, prioridade, plano, responsável). */
function NewTicketModal({ onClose, onSave, initial }: { onClose: () => void; onSave: (t: ProductionTicket) => void; initial?: ProductionTicket }) {
  const { blocks, tickets, currentUser } = useContext(AppContext);
  const lockDate = !!initial && !canEditDeadlines(currentUser!); // editar ticket ≠ mexer no prazo
  const [title, setTitle] = useState(initial?.title ?? "");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [blockId, setBlockId] = useState(initial?.blockId ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [slaDate, setSlaDate] = useState(initial?.slaDate ?? "");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "normal");
  const [plan, setPlan] = useState<ServiceType>(initial?.plan ?? "standard");
  const [desc, setDesc] = useState(initial?.desc ?? "");

  const internalUsers = USERS.filter((u) => u.role !== "client" && u.role !== "freelancer_bim" && u.active);
  const clientBlocks = blocks.filter((b) => b.clientId === clientId);
  const selectedBlock = blocks.find((b) => b.id === blockId);
  // Busca do bloco: marcas grandes têm 100+ blocos, e o <select> puro obriga a
  // rolar a lista inteira. Filtra por número, título, SKU ou CSKU; o bloco já
  // escolhido continua na lista mesmo que não bata com o texto digitado.
  const [blockQuery, setBlockQuery] = useState("");
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(blockQuery.trim());
  const filteredBlocks = clientBlocks
    .filter((b) => !q || b.id === blockId || norm(`#${b.n} ${b.title} ${b.sku ?? ""} ${b.csku ?? ""}`).includes(q))
    .sort((a, b) => (a.n ?? 0) - (b.n ?? 0));

  const canSave = title.trim() && clientId && slaDate;

  const handleSave = () => {
    const t: ProductionTicket = {
      id: initial?.id ?? `tk_${Date.now()}`,
      clientId,
      blockId: blockId || "",
      title: title.trim(),
      plan,
      slaDate,
      priority,
      assignedTo: assignedTo || undefined,
      status: initial?.status ?? "new",
      ...(desc.trim() ? { desc: desc.trim() } : {}),
      createdAt: initial ? initial.createdAt : new Date().toISOString(),
      ...(initial?.archivedAt ? { archivedAt: initial.archivedAt, archivedBy: initial.archivedBy } : {}),
    };
    onSave(t);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="font-semibold text-slate-900">{initial ? "Editar Ticket" : "Novo Ticket de Produção"}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Cúpulo – Revisão de Programação" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Cliente *</label>
              <select value={clientId} onChange={(e) => { setClientId(e.target.value); setBlockId(""); setBlockQuery(""); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition">
                <option value="">Selecionar...</option>
                {CLIENTS.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Bloco</label>
              <div className="relative mb-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={blockQuery}
                  onChange={(e) => setBlockQuery(e.target.value)}
                  disabled={!clientId}
                  placeholder={clientId ? `Buscar entre ${clientBlocks.length} blocos (nº, nome, SKU)…` : "Escolha o cliente primeiro"}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-cyan-400 transition disabled:opacity-50"
                />
              </div>
              <select value={blockId} onChange={(e) => setBlockId(e.target.value)} disabled={!clientId} size={q ? Math.min(8, filteredBlocks.length + 1) : undefined} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition disabled:opacity-50">
                <option value="">Nenhum</option>
                {filteredBlocks.map((b) => <option key={b.id} value={b.id}>#{b.n} · {b.title}</option>)}
              </select>
              {q && <p className="mt-1 text-[11px] text-slate-400">{filteredBlocks.length} de {clientBlocks.length} blocos{filteredBlocks.length === 0 ? " — nada com esse texto" : ""}</p>}
              {(() => {
                // Criar bloco já abre um ticket "– Modelagem" automaticamente; avisa
                // para a pessoa não abrir um segundo sem querer.
                const abertos = blockId ? tickets.filter((t) => t.blockId === blockId && isOpenTicket(t) && t.id !== initial?.id) : [];
                return abertos.length ? (
                  <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                    Este bloco já tem {abertos.length} ticket{abertos.length === 1 ? "" : "s"} em aberto: {abertos.map((t) => t.title).join(" · ")}. Confira antes de criar outro.
                  </p>
                ) : null;
              })()}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Responsável</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition">
                <option value="">Sem responsável</option>
                {internalUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">SLA *</label>
              <input type="date" value={slaDate} onChange={(e) => setSlaDate(e.target.value)} disabled={lockDate} title={lockDate ? "Seu perfil não tem a permissão 'Alterar prazos'" : undefined} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Prioridade</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition">
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
                <option value="low">Baixa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Plano</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value as ServiceType)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition">
                <option value="standard">Standard</option>
                <option value="plus">Plus</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Descrição</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="O que precisa ser feito, observações do cliente, link de referência…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition resize-y" />
          </div>
          {selectedBlock && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">Bloco: {selectedBlock.sku} · {selectedBlock.csku} · Etapa atual: {STATUS_LABELS[selectedBlock.status]}{selectedBlock.dueDate ? ` · Entrega prevista: ${fmtDate(selectedBlock.dueDate)}` : ""}. O prazo salvo aqui vira a data de entrega do bloco.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition">Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-sm font-semibold text-slate-900 disabled:opacity-30 hover:brightness-110 transition">{initial ? "Salvar" : "Criar Ticket"}</button>
        </div>
      </div>
    </div>
  );
}

type TicketSort = "recent" | "oldest" | "late" | "due_far" | "priority" | "brand";
type TicketDue = "all" | "late" | "week" | "month" | "later";
/** Ordenação/prazo/busca da tela de tickets sobrevivem a trocar de tela e voltar. */
const TICKETS_LIST_MEMORY: { sort: TicketSort; due: TicketDue; search: string } = { sort: "late", due: "all", search: "" };
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function ProductionTicketsPage({ user }: { user: SeedUser }) {
  const { blocks, setBlocks, tickets, setTickets, clients, users } = useContext(AppContext);
  const [filter, setFilter] = useState<TicketStatus | "all" | "archived">("all");
  // Ordenação e prazo: pedidos do Liles e do Victor (2026-09-21) — com muitas marcas
  // e blocos antigos misturados, a lista precisa mostrar primeiro o que importa.
  const [sort, setSort] = useState<TicketSort>(TICKETS_LIST_MEMORY.sort);
  const [due, setDue] = useState<TicketDue>(TICKETS_LIST_MEMORY.due);
  const [search, setSearch] = useState(TICKETS_LIST_MEMORY.search);
  useEffect(() => { Object.assign(TICKETS_LIST_MEMORY, { sort, due, search }); }, [sort, due, search]);
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>(""); // "" = todos · "none" = sem responsável
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [editingTicket, setEditingTicket] = useState<ProductionTicket | null>(null);
  // Perfil de acesso: criar / editar / excluir ticket. (O prazo dentro da edição pede também "Alterar prazos".)
  const canCreate = can(user, "tickets", "create");
  const canEdit = can(user, "tickets", "edit");
  const canDelete = can(user, "tickets", "delete");

  const isClient = user.role === "client";

  // Escopo do usuário + filtros de marca/pessoa, ANTES do filtro de status.
  // Os contadores das abas saem daqui, senão a aba diz "12 novos" enquanto a
  // lista mostra 2.
  const scoped = tickets.filter((t) => {
    if (isClient && t.clientId !== user.clientId) return false;
    if (filterClient && t.clientId !== filterClient) return false;
    if (filterAssignee === "none" && t.assignedTo) return false;
    if (filterAssignee && filterAssignee !== "none" && t.assignedTo !== filterAssignee) return false;
    return true;
  });
  const daysTo = (iso: string) => Math.ceil((new Date(`${iso}T12:00:00`).getTime() - Date.now()) / 86400000);
  const term = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visible = useMemo(() => {
    const blockOf = (t: ProductionTicket) => blocks.find((b) => b.id === t.blockId);
    const list = scoped.filter((t) => {
      // Arquivado só aparece na aba própria; "Todos" é tudo que NÃO está arquivado.
      if (filter === "archived" ? !t.archivedAt : !!t.archivedAt) return false;
      if (filter !== "all" && filter !== "archived" && t.status !== filter) return false;
      if (due !== "all") {
        if (t.status === "delivered") return false; // prazo só faz sentido para o que está em aberto
        const d = daysTo(t.slaDate);
        if (due === "late" ? d >= 0 : due === "week" ? d < 0 || d > 7 : due === "month" ? d < 0 || d > 30 : d <= 30) return false;
      }
      if (term) {
        const b = blockOf(t);
        const hay = `${t.title} ${t.desc ?? ""} ${b?.title ?? ""} ${b?.sku ?? ""} ${getClientName(t.clientId)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    const created = (t: ProductionTicket) => ticketCreatedAt(t, blockOf(t));
    return [...list].sort((a, b) =>
      sort === "recent" ? created(b).localeCompare(created(a))
      : sort === "oldest" ? (created(a) || "9999").localeCompare(created(b) || "9999")
      : sort === "late" ? a.slaDate.localeCompare(b.slaDate)          // mais atrasado primeiro
      : sort === "due_far" ? b.slaDate.localeCompare(a.slaDate)
      : sort === "priority" ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.slaDate.localeCompare(b.slaDate)
      : getClientName(a.clientId).localeCompare(getClientName(b.clientId)) || a.slaDate.localeCompare(b.slaDate));
  }, [scoped, blocks, filter, due, term, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Responsável do ticket = responsável do bloco (a tela do bloco mostra o mesmo campo).
  const syncBlockOwner = (blockId: string | undefined, userId: string | undefined) => {
    if (!blockId) return;
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, owner: userId || undefined } : b)));
  };
  // Prazo do ticket ligado a um bloco É a data de entrega do bloco (uma data só,
  // dois lugares para mexer). Mudou aqui → vira data manual no bloco.
  const pushDeadlineToBlock = (t: ProductionTicket, previous?: ProductionTicket) => {
    if (!t.blockId || (previous && previous.slaDate === t.slaDate && previous.blockId === t.blockId)) return;
    setBlocks((prev) => prev.map((b) => (b.id === t.blockId && b.dueDate !== t.slaDate ? { ...b, dueDate: t.slaDate, dueManual: true } : b)));
  };
  const createTicket = (t: ProductionTicket) => {
    const updated = [...tickets, t];
    setTickets(updated);
    if (t.assignedTo) syncBlockOwner(t.blockId, t.assignedTo);
    pushDeadlineToBlock(t);
  };
  const saveTicket = (t: ProductionTicket) => {
    const previous = tickets.find((x) => x.id === t.id);
    setTickets(tickets.map((x) => (x.id === t.id ? t : x)));
    if (previous?.assignedTo !== t.assignedTo) syncBlockOwner(t.blockId, t.assignedTo);
    pushDeadlineToBlock(t, previous);
  };
  const archiveTicket = (t: ProductionTicket, on: boolean) =>
    setTickets(tickets.map((x) => (x.id === t.id ? (on ? { ...x, archivedAt: new Date().toISOString(), archivedBy: user.name } : { ...x, archivedAt: undefined, archivedBy: undefined }) : x)));
  /** Limpeza em lote: tudo que já foi entregue sai da frente, sem apagar. */
  const archiveDelivered = () => {
    const alvo = scoped.filter((t) => t.status === "delivered" && !t.archivedAt);
    if (!alvo.length || !confirm(`Arquivar ${alvo.length} ticket(s) entregue(s)${filterClient ? ` de ${getClientName(filterClient)}` : ""}?\n\nEles saem das listas e continuam na aba "Arquivados".`)) return;
    const ids = new Set(alvo.map((t) => t.id)); const at = new Date().toISOString();
    setTickets(tickets.map((x) => (ids.has(x.id) ? { ...x, archivedAt: at, archivedBy: user.name } : x)));
  };
  const deleteTicket = (t: ProductionTicket) => {
    if (!confirm(`Excluir o ticket "${t.title}"?\n\nO bloco não é afetado.`)) return;
    setTickets(tickets.filter((x) => x.id !== t.id));
  };

  const [autoMsg, setAutoMsg] = useState("");
  const updateStatus = (id: string, status: TicketStatus) => {
    const ticket = tickets.find((t) => t.id === id);
    const block = blocks.find((b) => b.id === ticket?.blockId);
    let updated = tickets.map((t) => (t.id === id ? { ...t, status } : t));
    // Situação do ticket move a etapa do bloco (blockStatusForTicket) — e o bloco
    // novo, por sua vez, ajusta título/prazo dos tickets abertos e abre o ticket da
    // próxima fase de produção (ex.: SketchUp entregue → nasce o ticket de BIM).
    const nextStatus = block && ticket ? blockStatusForTicket(status, block) : null;
    if (block && nextStatus) {
      const nb = withStatus(block, nextStatus);
      setBlocks(blocks.map((b) => (b.id === nb.id ? nb : b)));
      updated = syncTicketsWithBlock(updated, nb);
      const phase = PRODUCTION_PHASE_LABELS[nextStatus];
      if (phase && !updated.some((t) => t.blockId === nb.id && isOpenTicket(t))) {
        updated = [...updated, { id: `tk_${Date.now()}`, clientId: nb.clientId, blockId: nb.id, title: `${nb.title} – ${phase}`, plan: nb.svc, slaDate: nb.dueDate || addDaysISO(todayISO(), SLA_DAYS), priority: nb.pri, assignedTo: nb.owner, status: "new", createdAt: new Date().toISOString() }];
      }
      setAutoMsg(`Bloco "${nb.title}" avançou para ${STATUS_LABELS[nextStatus]}${phase ? ` · ticket de ${phase} criado` : ""}.`);
      setTimeout(() => setAutoMsg(""), 7000);
    }
    setTickets(updated);
  };

  const assignTicket = (id: string, userId: string) => {
    const updated = tickets.map((t) => t.id === id ? { ...t, assignedTo: userId || undefined } : t);
    setTickets(updated);
    syncBlockOwner(tickets.find((t) => t.id === id)?.blockId, userId);
  };

  const internalUsers = users.filter((u) => u.role !== "client" && u.role !== "freelancer_bim" && u.active);
  const counts = { all: 0, new: 0, in_production: 0, internal_review: 0, delivered: 0, archived: 0 };
  scoped.forEach((t) => { if (t.archivedAt) counts.archived++; else { counts.all++; counts[t.status]++; } });
  const lateCount = scoped.filter((t) => isOpenTicket(t) && daysTo(t.slaDate) < 0).length;

  // Só listamos no seletor quem/o que de fato tem ticket — evita menu enorme
  // de opções que só levam a tela vazia.
  const marcasComTicket = clients.filter((c) => tickets.some((t) => t.clientId === c.id));
  const responsaveisComTicket = internalUsers.filter((u) => tickets.some((t) => t.assignedTo === u.id));
  const semResponsavel = tickets.filter((t) => !isClient || t.clientId === user.clientId).some((t) => !t.assignedTo);
  const filtrosAtivos = !!filterClient || !!filterAssignee;

  return (
    <div className="space-y-6">
      {showNewTicket && <NewTicketModal onClose={() => setShowNewTicket(false)} onSave={createTicket} />}
      {editingTicket && <NewTicketModal initial={editingTicket} onClose={() => setEditingTicket(null)} onSave={saveTicket} />}
      {autoMsg && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{autoMsg}</div>}
      <SectionHeader
        eyebrow="Fase 5 · Produção"
        title="Tickets de produção"
        description="Cada ticket é uma etapa de um bloco 3D. Marcar o ticket como Entregue conclui a etapa e avança o bloco sozinho."
        action={
          <div className="flex items-center gap-2">
            <Badge className="border-slate-200/80 bg-white/80 text-slate-600">{counts.all} tickets</Badge>
            {!isClient && canCreate && (
              <button onClick={() => setShowNewTicket(true)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:brightness-110 transition">
                <Plus className="w-3.5 h-3.5" /> Novo Ticket
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {([["all", "Todos", counts.all], ["new", "Novos", counts.new], ["in_production", "Em Produção", counts.in_production], ["internal_review", "Revisão", counts.internal_review], ["delivered", "Entregues", counts.delivered], ["archived", "Arquivados", counts.archived]] as const).map(([id, label, count]) => (
          <TabBtn key={id} active={filter === id} label={label} count={count} onClick={() => setFilter(id)} />
        ))}
        {!isClient && (
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 outline-none focus:border-cyan-400 transition"
            >
              <option value="">Todas as marcas</option>
              {marcasComTicket.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 outline-none focus:border-cyan-400 transition"
            >
              <option value="">Todos os responsáveis</option>
              {semResponsavel && <option value="none">Sem responsável</option>}
              {responsaveisComTicket.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {filtrosAtivos && (
              <button
                onClick={() => { setFilterClient(""); setFilterAssignee(""); }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1.5"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Organização: busca, prazo e ordem. Fica guardado ao sair e voltar da tela. */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, descrição, produto, SKU ou marca…" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" />
          </div>
          <select value={due} onChange={(e) => setDue(e.target.value as TicketDue)} title="Filtrar pelo prazo" className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
            <option value="all">Prazo: todos</option>
            <option value="late">Prazo: atrasados{lateCount ? ` (${lateCount})` : ""}</option>
            <option value="week">Prazo: vence em 7 dias</option>
            <option value="month">Prazo: vence em 30 dias</option>
            <option value="later">Prazo: depois de 30 dias</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as TicketSort)} title="Ordenação" className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
            <option value="late">Ordem: mais atrasado primeiro</option>
            <option value="due_far">Ordem: prazo mais distante primeiro</option>
            <option value="recent">Ordem: mais recente → mais antigo</option>
            <option value="oldest">Ordem: mais antigo → mais recente</option>
            <option value="priority">Ordem: prioridade</option>
            <option value="brand">Ordem: marca</option>
          </select>
          {(search || due !== "all") && <button onClick={() => { setSearch(""); setDue("all"); }} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-1">Limpar</button>}
          {canEdit && !isClient && filter !== "archived" && counts.delivered > 0 && (
            <button onClick={archiveDelivered} title="Tira da frente tudo que já foi entregue, sem apagar" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition"><Archive className="h-3.5 w-3.5" /> Arquivar entregues ({counts.delivered})</button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{visible.length} ticket{visible.length === 1 ? "" : "s"} na lista{filter === "archived" ? " · arquivados não contam em alertas nem na fila" : ""}</p>
      </Card>

      {visible.length === 0 ? (
        <Card className="p-4"><EmptyState icon={Hash} title="Nenhum ticket encontrado" desc="Não há tickets para o filtro selecionado." /></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((ticket) => {
            const block = blocks.find((b) => b.id === ticket.blockId);
            const client = clients.find((c) => c.id === ticket.clientId);
            const assignedUser = users.find((u) => u.id === ticket.assignedTo);
            const daysLeft = daysTo(ticket.slaDate);
            const closed = !isOpenTicket(ticket);
            const slaUrgent = !closed && daysLeft <= 3;
            const createdAt = ticketCreatedAt(ticket, block);

            return (
              <Card key={ticket.id} className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className={TICKET_STATUS_COLORS[ticket.status]}>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                      <ServiceBadge type={ticket.plan} />
                      <PriorityDot priority={ticket.priority} />
                    </div>
                    <p className="text-base font-semibold text-slate-900">{ticketDisplayTitle(ticket, block)}</p>
                    <p className="text-sm text-slate-500 mt-1">{client?.name} · Bloco #{block?.n || "—"} · {block?.sku || ticket.blockId}</p>
                    {block && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        Etapa do bloco: <StatusBadge status={block.status} />
                        {block.materialsAt && <span>· materiais em {fmtDate(block.materialsAt)}</span>}
                      </p>
                    )}
                    {ticket.desc && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">{ticket.desc}</p>}
                    {ticket.archivedAt && <p className="mt-2 text-[11px] text-slate-400">Arquivado em {fmtDate(ticket.archivedAt.slice(0, 10))}{ticket.archivedBy ? ` por ${ticket.archivedBy}` : ""}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${slaUrgent ? "text-rose-600" : "text-slate-700"}`}>
                      {closed ? (ticket.archivedAt ? "Arquivado" : "Entregue") : daysLeft < 0 ? `⚠ ${-daysLeft}d de atraso` : slaUrgent ? `⚠ ${daysLeft}d restantes` : `${daysLeft}d até o prazo`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Prazo: {fmtDate(ticket.slaDate)}</p>
                    {createdAt && <p className="text-[11px] text-slate-400 mt-0.5">Criado em {fmtDate(createdAt.slice(0, 10))}</p>}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  {!isClient && (
                    <>
                      <select value={ticket.assignedTo || ""} onChange={(e) => assignTicket(ticket.id, e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-cyan-400 transition">
                        <option value="">Sem responsável</option>
                        {internalUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <select value={ticket.status} onChange={(e) => updateStatus(ticket.id, e.target.value as TicketStatus)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-cyan-400 transition">
                        {(["new", "in_production", "internal_review", "delivered"] as TicketStatus[]).map((s) => <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>)}
                      </select>
                    </>
                  )}
                  {(canEdit || canDelete) && (
                    <>
                      {canEdit && <button onClick={() => setEditingTicket(ticket)} title="Editar título, bloco, prazo, prioridade e plano" className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition"><Settings className="h-3 w-3" /> Editar</button>}
                      {canEdit && <button onClick={() => archiveTicket(ticket, !ticket.archivedAt)} title={ticket.archivedAt ? "Volta para as listas" : "Tira das listas e dos alertas, sem apagar"} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition"><Archive className="h-3 w-3" /> {ticket.archivedAt ? "Desarquivar" : "Arquivar"}</button>}
                      {canDelete && <button onClick={() => deleteTicket(ticket)} title="Excluir ticket" className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-400 hover:border-rose-200 hover:text-rose-600 transition"><X className="h-3 w-3" /></button>}
                    </>
                  )}
                  {assignedUser && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
                        {assignedUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      {assignedUser.name}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// BIM · TERCEIRIZADOS (Danilo, Raquel) — espelho do "Demandas" do Notion
// ============================================================
const BIM_ALL_FORMATS: BimFormat[] = ["archicad", "revit", "sketchup"];

function BimDemandCard({ d, mode, clientName, freelancerName, onToggle, onStatus, onEdit, onDelete, onFreelancerNotes }: {
  d: BimDemand;
  mode: "internal" | "freelancer";
  clientName: string;
  freelancerName?: string;
  onToggle: (itemId: string, fmt: BimFormat) => void;
  onStatus: (status: BimDemandStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFreelancerNotes?: (text: string) => void;
}) {
  const [open, setOpen] = useState(mode === "freelancer" && bimIsOpen(d));
  const [notesDraft, setNotesDraft] = useState(d.freelancerNotes || "");
  const prog = bimProgress(d);
  const isOpen = bimIsOpen(d);
  const days = bimDaysLeft(d);
  const late = isOpen && days < 0;
  const soon = isOpen && days >= 0 && days <= 3;

  return (
    <Card className={`p-5 ${late ? "border-rose-200" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge className={BIM_STATUS_COLORS[d.status]}>{BIM_STATUS_LABELS[d.status]}</Badge>
            {late && <Badge className="border-rose-200 bg-rose-50 text-rose-700">{Math.abs(days)}d atrasada</Badge>}
            {soon && <Badge className="border-amber-200 bg-amber-50 text-amber-700">{days === 0 ? "vence hoje" : `${days}d p/ o prazo`}</Badge>}
          </div>
          <p className="text-base font-semibold text-slate-900">{d.title}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {clientName} · {d.productCount} produto{d.productCount === 1 ? "" : "s"}
            {mode === "internal" && freelancerName ? ` · ${freelancerName}` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 flex-shrink-0">
          <p>Pedido {fmtDate(d.requestedAt)}</p>
          <p className={late ? "text-rose-600 font-semibold" : ""}>Prazo {fmtDate(d.dueAt)}</p>
          {d.deliveredAt && <p className="text-emerald-700">Entregue {fmtDate(d.deliveredAt)}</p>}
          {mode === "internal" && d.unitPrice ? <p className="mt-1 text-slate-400">R$ {d.unitPrice.toLocaleString("pt-BR")}/produto · total R$ {(d.unitPrice * d.productCount).toLocaleString("pt-BR")}</p> : null}
        </div>
      </div>

      {prog.total > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5"><span>Arquivos entregues</span><span className="font-semibold text-slate-700">{prog.done} / {prog.total}</span></div>
          <ProgressBar value={prog.pct} />
        </div>
      )}

      {d.notes && <p className="mt-3 text-sm text-slate-600 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 whitespace-pre-wrap">{d.notes}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {d.items.length > 0 && (
          <button onClick={() => setOpen(!open)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1">
            <ChevronRight className={`w-3.5 h-3.5 transition ${open ? "rotate-90" : ""}`} /> {open ? "Ocultar" : "Ver"} produtos ({d.items.length})
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {mode === "freelancer" && isOpen && d.status !== "in_progress" && (
            <button onClick={() => onStatus("in_progress")} className="px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 text-xs font-semibold text-sky-700 hover:bg-sky-100">Comecei</button>
          )}
          {mode === "freelancer" && isOpen && d.status !== "waiting_info" && (
            <button onClick={() => onStatus("waiting_info")} className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700 hover:bg-amber-100">Preciso de informação</button>
          )}
          {mode === "freelancer" && isOpen && (
            <button onClick={() => { if (confirm("Marcar esta demanda como entregue? A equipe ATT será avisada aqui no portal.")) onStatus("delivered"); }} className="px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">Marcar como entregue</button>
          )}
          {mode === "internal" && (
            <select value={d.status} onChange={(e) => onStatus(e.target.value as BimDemandStatus)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              {BIM_STATUS_ORDER.map((st) => <option key={st} value={st}>{BIM_STATUS_LABELS[st]}</option>)}
            </select>
          )}
          {mode === "internal" && d.status === "delivered" && (
            <button onClick={() => onStatus("approved")} className="px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">Aprovar entrega</button>
          )}
          {mode === "internal" && onEdit && <button onClick={onEdit} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Editar</button>}
          {mode === "internal" && onDelete && <button onClick={onDelete} className="px-2 py-1.5 rounded-xl text-slate-400 hover:text-rose-600" title="Excluir"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {open && d.items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {d.items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{it.code || it.name}</p>
                {it.code && it.name && it.code !== it.name && <p className="text-xs text-slate-400 truncate">{it.name}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {it.formats.map((f) => {
                  const done = it.done.includes(f);
                  return (
                    <button key={f} onClick={() => onToggle(it.id, f)} title={`${BIM_FORMAT_LABELS[f]}-${bimFileSlug(it.name || it.code)}`}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${done ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                      {done ? "✓ " : ""}{BIM_FORMAT_LABELS[f]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "freelancer" && isOpen && onFreelancerNotes && (
        <div className="mt-3">
          <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} onBlur={() => notesDraft !== (d.freelancerNotes || "") && onFreelancerNotes(notesDraft)}
            rows={2} placeholder="Observação para a equipe ATT (dúvida, arquivo faltando, link de entrega…)"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-400" />
        </div>
      )}
      {mode === "internal" && d.freelancerNotes && (
        <p className="mt-3 text-sm text-amber-900 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 whitespace-pre-wrap"><span className="text-xs font-semibold uppercase tracking-wider text-amber-600 mr-2">Terceirizado</span>{d.freelancerNotes}</p>
      )}
    </Card>
  );
}

function BimDemandFormModal({ initial, onClose, onSave, freelancers, clients, blocks, currentUserId }: {
  initial?: BimDemand; onClose: () => void; onSave: (d: BimDemand) => void;
  freelancers: SeedUser[]; clients: SeedClient[]; blocks: SeedBlock[]; currentUserId: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [freelancerId, setFreelancerId] = useState(initial?.freelancerId ?? freelancers[0]?.id ?? "");
  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [productCount, setProductCount] = useState(String(initial?.productCount ?? ""));
  const [requestedAt, setRequestedAt] = useState(initial?.requestedAt ?? today);
  const [dueAt, setDueAt] = useState(initial?.dueAt ?? "");
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice ? String(initial.unitPrice) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<BimDemandItem[]>(initial?.items ?? []);
  const [pickBlock, setPickBlock] = useState("");

  const brandBlocks = blocks.filter((b) => b.clientId === clientId && !items.some((i) => i.blockId === b.id));
  const addFromBlock = () => {
    const b = blocks.find((x) => x.id === pickBlock);
    if (!b) return;
    setItems([...items, { id: `bi_${Date.now()}`, blockId: b.id, code: b.sku, name: b.title, formats: ["archicad", "revit"], done: [] }]);
    setPickBlock("");
  };
  const addFree = () => setItems([...items, { id: `bi_${Date.now()}`, code: "", name: "", formats: ["archicad", "revit"], done: [] }]);
  const patchItem = (id: string, p: Partial<BimDemandItem>) => setItems(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const toggleFmt = (id: string, f: BimFormat) => setItems(items.map((i) => (i.id === id ? { ...i, formats: i.formats.includes(f) ? i.formats.filter((x) => x !== f) : [...i.formats, f] } : i)));

  const count = Number(productCount) || items.length;
  const canSave = freelancerId && clientId && title.trim() && dueAt && count > 0;

  const save = () => {
    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? `bim_${Date.now()}`,
      freelancerId, clientId, title: title.trim(),
      productCount: count,
      items: items.filter((i) => i.code.trim() || i.name.trim()).map((i) => ({ ...i, code: i.code.trim(), name: i.name.trim() || i.code.trim() })),
      status: initial?.status ?? "not_started",
      requestedAt, dueAt,
      deliveredAt: initial?.deliveredAt, approvedAt: initial?.approvedAt,
      unitPrice: unitPrice ? Number(unitPrice) : undefined,
      notes: notes.trim() || undefined,
      freelancerNotes: initial?.freelancerNotes,
      createdBy: initial?.createdBy ?? currentUserId,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{initial ? "Editar demanda BIM" : "Nova demanda BIM"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="text-xs font-medium text-slate-500">Terceirizado *</label>
              <select value={freelancerId} onChange={(e) => setFreelancerId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                {freelancers.length === 0 && <option value="">Cadastre um usuário com perfil "Terceirizado BIM"</option>}
                {freelancers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></div>
            <div><label className="text-xs font-medium text-slate-500">Marca *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          </div>
          <div><label className="text-xs font-medium text-slate-500">Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Green House Remessa 04" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
          <div className="grid gap-3 md:grid-cols-4">
            <div><label className="text-xs font-medium text-slate-500">Nº de produtos *</label>
              <input type="number" min={1} value={productCount} onChange={(e) => setProductCount(e.target.value)} placeholder={String(items.length || "")} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div><label className="text-xs font-medium text-slate-500">Pedido em</label>
              <input type="date" value={requestedAt} onChange={(e) => setRequestedAt(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div><label className="text-xs font-medium text-slate-500">Prazo *</label>
              <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div><label className="text-xs font-medium text-slate-500">R$ / produto</label>
              <input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="opcional" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
          </div>
          <div><label className="text-xs font-medium text-slate-500">Orientações para o terceirizado</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex: seguir padrão 2026-GH-01-01-CADEIRA… → Archicad-Cadeira… / Revit-Cadeira…" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>

          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-medium text-slate-500">Produtos e arquivos ({items.length}) <span className="text-slate-400">— opcional; sem lista, o acompanhamento é só pelo status</span></label>
              <button onClick={addFree} className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Produto avulso</button>
            </div>
            {brandBlocks.length > 0 && (
              <div className="mt-2 flex gap-2">
                <select value={pickBlock} onChange={(e) => setPickBlock(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                  <option value="">Adicionar bloco já cadastrado no portal…</option>
                  {brandBlocks.map((b) => <option key={b.id} value={b.id}>{b.sku} · {b.title}</option>)}
                </select>
                <button onClick={addFromBlock} disabled={!pickBlock} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-30">Adicionar</button>
              </div>
            )}
            <div className="mt-2 space-y-2">
              {items.map((it) => (
                <div key={it.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={it.code} onChange={(e) => patchItem(it.id, { code: e.target.value })} placeholder="Código interno (2026-GH-01-01-…)" className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-mono" />
                    <input value={it.name} onChange={(e) => patchItem(it.id, { name: e.target.value })} placeholder="Nome do produto" className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm" />
                    <button onClick={() => setItems(items.filter((i) => i.id !== it.id))} className="p-1.5 text-slate-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400 mr-1">Entregar:</span>
                    {BIM_ALL_FORMATS.map((f) => (
                      <button key={f} onClick={() => toggleFmt(it.id, f)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${it.formats.includes(f) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200"}`}>{BIM_FORMAT_LABELS[f]}</button>
                    ))}
                    {it.name && <span className="ml-auto text-xs text-slate-400 font-mono">{it.formats.map((f) => `${BIM_FORMAT_LABELS[f]}-${bimFileSlug(it.name)}`).join(" · ")}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={save} disabled={!canSave} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-30 hover:bg-slate-800">Salvar</button>
        </div>
      </div>
    </div>
  );
}

/** Tela da equipe interna: todas as demandas, filtros, criação/edição, aprovação. */
function BimPage({ user }: { user: SeedUser }) {
  const { bimDemands, setBimDemands, users, clients, blocks } = useContext(AppContext);
  const [filterFreelancer, setFilterFreelancer] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState<"open" | "all" | BimDemandStatus>("open");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BimDemand | null>(null);

  const freelancers = users.filter((u) => u.role === "freelancer_bim" && u.active);
  const canCreate = can(user, "bim", "create");
  const canEdit = can(user, "bim", "edit");
  const canDelete = can(user, "bim", "delete");

  const list = bimDemands
    .filter((d) => (!filterFreelancer || d.freelancerId === filterFreelancer) && (!filterClient || d.clientId === filterClient))
    .filter((d) => filterStatus === "all" ? true : filterStatus === "open" ? bimIsOpen(d) : d.status === filterStatus)
    .sort((a, b) => (bimIsOpen(a) === bimIsOpen(b) ? a.dueAt.localeCompare(b.dueAt) : bimIsOpen(a) ? -1 : 1));

  const open = bimDemands.filter(bimIsOpen);
  const openProducts = open.reduce((n, d) => n + d.productCount, 0);
  const late = open.filter((d) => bimDaysLeft(d) < 0);
  const waitingApproval = bimDemands.filter((d) => d.status === "delivered");
  const month = new Date().toISOString().slice(0, 7);
  const deliveredMonth = bimDemands.filter((d) => (d.deliveredAt || "").slice(0, 7) === month).reduce((n, d) => n + d.productCount, 0);

  const upsert = (d: BimDemand) => {
    setBimDemands((prev) => (prev.some((x) => x.id === d.id) ? prev.map((x) => (x.id === d.id ? d : x)) : [...prev, d]));
    setShowForm(false); setEditing(null);
  };
  const setStatus = (d: BimDemand, status: BimDemandStatus) => {
    const today = new Date().toISOString().slice(0, 10);
    upsert({ ...d, status,
      deliveredAt: status === "delivered" || status === "approved" ? (d.deliveredAt || today) : d.deliveredAt,
      approvedAt: status === "approved" ? (d.approvedAt || today) : undefined,
      updatedAt: new Date().toISOString() });
  };
  const toggle = (d: BimDemand, itemId: string, fmt: BimFormat) => {
    upsert({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, done: i.done.includes(fmt) ? i.done.filter((f) => f !== fmt) : [...i.done, fmt] } : i)), updatedAt: new Date().toISOString() });
  };
  const remove = (d: BimDemand) => { if (confirm(`Excluir a demanda "${d.title}"?`)) setBimDemands((prev) => prev.filter((x) => x.id !== d.id)); };

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name || "—";
  const clientOf = (id: string) => clients.find((c) => c.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      {(showForm || editing) && <BimDemandFormModal initial={editing ?? undefined} onClose={() => { setShowForm(false); setEditing(null); }} onSave={upsert} freelancers={freelancers} clients={clients} blocks={blocks} currentUserId={user.id} />}
      <SectionHeader
        eyebrow="Produção · Blocos BIM"
        title="BIM · Terceirizados"
        description="Demandas de blocos ArchiCAD / Revit / SketchUp enviadas aos terceirizados. Cada demanda é um lote de produtos de uma marca, com prazo e entrega — o mesmo controle que ficava no Notion, agora com a página do terceirizado ligada a esta."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="border-slate-200/80 bg-white/80 text-slate-600">{bimDemands.length} demandas</Badge>
            {canCreate && <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:brightness-110 transition"><Plus className="w-3.5 h-3.5" /> Nova demanda</button>}
          </div>
        }
      />

      {freelancers.length === 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50"><p className="text-sm text-amber-800">Nenhum usuário com perfil <b>Terceirizado BIM</b> ainda. Cadastre Danilo e Raquel em <b>Usuários</b> com esse perfil — eles entram com e-mail e senha e veem só as próprias demandas.</p></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Box} label="Produtos em aberto" value={openProducts} sub={`${open.length} demanda${open.length === 1 ? "" : "s"}`} />
        <MetricCard icon={AlertTriangle} label="Atrasadas" value={late.length} sub={late.length ? late.map((d) => d.title).slice(0, 2).join(" · ") : "Nenhuma no prazo vencido"} color={late.length ? "text-rose-600" : "text-slate-900"} />
        <MetricCard icon={CheckCircle} label="Aguardando aprovação" value={waitingApproval.length} sub="Entregues pelo terceirizado, a validar" color="text-emerald-600" />
        <MetricCard icon={Clock} label="Entregues no mês" value={deliveredMonth} sub="produtos" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([["open", "Abertas"], ["all", "Todas"], ...BIM_STATUS_ORDER.map((st) => [st, BIM_STATUS_LABELS[st]])] as [string, string][]).map(([id, label]) => (
          <TabBtn key={id} active={filterStatus === id} label={label} count={id === "open" ? open.length : id === "all" ? bimDemands.length : bimDemands.filter((d) => d.status === id).length} onClick={() => setFilterStatus(id as typeof filterStatus)} />
        ))}
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <select value={filterFreelancer} onChange={(e) => setFilterFreelancer(e.target.value)} className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600">
            <option value="">Todos os terceirizados</option>
            {freelancers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600">
            <option value="">Todas as marcas</option>
            {clients.filter((c) => bimDemands.some((d) => d.clientId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="p-4"><EmptyState icon={Box} title="Nenhuma demanda aqui" desc={bimDemands.length === 0 ? "Crie a primeira demanda: escolha o terceirizado, a marca, o prazo e (se quiser) a lista de produtos." : "Nada para o filtro selecionado."} /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <BimDemandCard key={d.id} d={d} mode="internal" clientName={clientOf(d.clientId)} freelancerName={nameOf(d.freelancerId)}
              onToggle={(itemId, fmt) => toggle(d, itemId, fmt)} onStatus={(st) => setStatus(d, st)}
              onEdit={canEdit ? () => setEditing(d) : undefined} onDelete={canDelete ? () => remove(d) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Tela do terceirizado: só as próprias demandas. Marca arquivo a arquivo e sinaliza entrega. */
function BimMinhasDemandasPage({ user }: { user: SeedUser }) {
  const { bimDemands, setBimDemands, clients } = useContext(AppContext);
  const mine = bimDemands.filter((d) => d.freelancerId === user.id);
  const open = mine.filter(bimIsOpen).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const closed = mine.filter((d) => !bimIsOpen(d)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const late = open.filter((d) => bimDaysLeft(d) < 0).length;
  const pendingFiles = open.reduce((n, d) => { const p = bimProgress(d); return n + Math.max(p.total - p.done, 0); }, 0);
  const month = new Date().toISOString().slice(0, 7);
  const deliveredMonth = mine.filter((d) => (d.deliveredAt || "").slice(0, 7) === month).reduce((n, d) => n + d.productCount, 0);

  const update = (d: BimDemand) => setBimDemands((prev) => prev.map((x) => (x.id === d.id ? { ...d, updatedAt: new Date().toISOString() } : x)));
  const setStatus = (d: BimDemand, status: BimDemandStatus) => {
    // Terceirizado nunca aprova a própria entrega — isso é da equipe ATT.
    if (status === "approved") return;
    update({ ...d, status, deliveredAt: status === "delivered" ? new Date().toISOString().slice(0, 10) : d.deliveredAt });
  };
  const toggle = (d: BimDemand, itemId: string, fmt: BimFormat) =>
    update({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, done: i.done.includes(fmt) ? i.done.filter((f) => f !== fmt) : [...i.done, fmt] } : i)) });
  const clientOf = (id: string) => clients.find((c) => c.id === id)?.name || "—";

  const groups = closed.reduce<Record<string, BimDemand[]>>((acc, d) => { const k = bimMonthKey(d.deliveredAt || d.requestedAt); (acc[k] ||= []).push(d); return acc; }, {});

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Blocos BIM · ArchTechTour"
        title={`Olá, ${user.name.split(" ")[0]}. Suas demandas.`}
        description="Cada demanda é um lote de produtos de uma marca. Marque cada arquivo conforme entregar e, ao terminar o lote, clique em “Marcar como entregue” — a equipe ATT vê na hora."
        action={<Badge className="border-slate-200/80 bg-white/80 text-slate-600">{open.length} aberta{open.length === 1 ? "" : "s"}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Box} label="Produtos em aberto" value={open.reduce((n, d) => n + d.productCount, 0)} sub={`${open.length} demanda${open.length === 1 ? "" : "s"}`} />
        <MetricCard icon={FileText} label="Arquivos pendentes" value={pendingFiles} sub="nas demandas com lista de produtos" />
        <MetricCard icon={AlertTriangle} label="Atrasadas" value={late} color={late ? "text-rose-600" : "text-slate-900"} sub={late ? "Prazo vencido — fale com a equipe" : "Tudo dentro do prazo"} />
        <MetricCard icon={CheckCircle} label="Entregues no mês" value={deliveredMonth} sub="produtos" color="text-emerald-600" />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 mb-3">Em aberto</p>
        {open.length === 0 ? (
          <Card className="p-4"><EmptyState icon={CheckCircle} title="Nenhuma demanda em aberto" desc="Quando a equipe ATT enviar um novo lote, ele aparece aqui." /></Card>
        ) : (
          <div className="space-y-3">
            {open.map((d) => (
              <BimDemandCard key={d.id} d={d} mode="freelancer" clientName={clientOf(d.clientId)}
                onToggle={(itemId, fmt) => toggle(d, itemId, fmt)} onStatus={(st) => setStatus(d, st)}
                onFreelancerNotes={(text) => update({ ...d, freelancerNotes: text || undefined })} />
            ))}
          </div>
        )}
      </div>

      {Object.keys(groups).length > 0 && (
        <div className="space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Entregues</p>
          {Object.entries(groups).map(([k, ds]) => (
            <div key={k}>
              <p className="text-sm font-semibold text-slate-600 mb-2">{k} <span className="text-slate-400 font-normal">· {ds.reduce((n, d) => n + d.productCount, 0)} produtos</span></p>
              <div className="space-y-3">
                {ds.map((d) => (
                  <BimDemandCard key={d.id} d={d} mode="freelancer" clientName={clientOf(d.clientId)} onToggle={(itemId, fmt) => toggle(d, itemId, fmt)} onStatus={(st) => setStatus(d, st)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ACABAMENTOS — catálogo por marca + cadastro por produto (espelho do Notion)
// ============================================================
function useFinishes() {
  const { finishes, setFinishes } = useContext(AppContext);
  const catalogFor = (clientId: string): FinishCatalog =>
    (finishes.find((f) => f.kind === "catalog" && f.clientId === clientId) as FinishCatalog | undefined) ?? emptyCatalog(clientId);
  const forBlock = (blockId: string): BlockFinishes | undefined =>
    finishes.find((f) => f.kind === "block" && (f as BlockFinishes).blockId === blockId) as BlockFinishes | undefined;
  const upsert = (rec: FinishRecord) =>
    setFinishes((prev) => (prev.some((f) => f.id === rec.id) ? prev.map((f) => (f.id === rec.id ? rec : f)) : [...prev, rec]));
  return { finishes, catalogFor, forBlock, upsert };
}

function Chip({ active, onClick, children, tone = "slate" }: { active: boolean; onClick: () => void; children: ReactNode; tone?: "slate" | "teal" }) {
  const on = tone === "teal" ? "bg-teal-600 text-white border-teal-600" : "bg-slate-900 text-white border-slate-900";
  return (
    <button type="button" onClick={onClick} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${active ? on : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
      {active ? "✓ " : ""}{children}
    </button>
  );
}

/** Aba "Acabamentos" do detalhe do bloco: o cliente diz o que vai em cada parte do produto. */
function BlockFinishesTab({ block, user, setPage }: { block: SeedBlock; user: SeedUser; setPage: (p: string) => void }) {
  const { catalogFor, forBlock, upsert } = useFinishes();
  const catalog = catalogFor(block.clientId);
  const saved = forBlock(block.id);
  const [draft, setDraft] = useState<BlockFinishes>(saved ?? emptyBlockFinishes(block.clientId, block.id));
  const [newVar, setNewVar] = useState("");
  const [newOpt, setNewOpt] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(saved ?? emptyBlockFinishes(block.clientId, block.id)); }, [saved?.id, saved?.updatedAt, block.id, block.clientId]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify({ ...draft, updatedAt: "", updatedBy: "" }) !== JSON.stringify({ ...(saved ?? emptyBlockFinishes(block.clientId, block.id)), updatedAt: "", updatedBy: "" });

  const toggle = (gid: string, oid: string) => {
    const cur = draft.selections[gid] || [];
    setDraft({ ...draft, selections: { ...draft.selections, [gid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] } });
  };
  const addOption = (g: FinishGroup) => {
    const name = (newOpt[g.id] || "").trim(); if (!name) return;
    const oid = `${slugId(name)}-${Date.now().toString(36)}`;
    upsert({ ...catalog, groups: catalog.groups.map((x) => (x.id === g.id ? { ...x, options: [...x.options, { id: oid, name }] } : x)), updatedAt: new Date().toISOString(), updatedBy: user.name });
    setDraft({ ...draft, selections: { ...draft.selections, [g.id]: [...(draft.selections[g.id] || []), oid] } });
    setNewOpt({ ...newOpt, [g.id]: "" });
  };
  const save = () => upsert({ ...draft, updatedAt: new Date().toISOString(), updatedBy: user.name });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">O que vai em cada parte do produto</h3>
            <p className="text-xs text-slate-500 mt-1">Marque, em cada grupo, os acabamentos que este produto aceita. Se faltar uma opção, adicione ali mesmo — ela entra no catálogo da marca.</p>
          </div>
          <div className="flex items-center gap-2">
            {isFilled(saved) ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Cadastrado</Badge> : <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>}
            {can(user, "finishes", "edit") ? <button onClick={save} disabled={!dirty} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-30 hover:bg-slate-800">Salvar</button> : <span className="text-[11px] text-slate-400">Somente consulta</span>}
          </div>
        </div>
        {catalog.groups.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            A marca ainda não tem grupos de acabamento cadastrados (Tecidos, Madeiras, Pinturas…).
            <button onClick={() => setPage("finishes")} className="ml-2 font-semibold text-cyan-700 hover:underline">Cadastrar catálogo da marca</button>
          </div>
        )}
        <div className="mt-4 space-y-4">
          {catalog.groups.map((g) => (
            <div key={g.id}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{g.name} <span className="normal-case tracking-normal font-normal text-slate-400">· {(draft.selections[g.id] || []).length} de {g.options.length}</span></p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {g.options.map((o) => <Chip key={o.id} active={(draft.selections[g.id] || []).includes(o.id)} onClick={() => toggle(g.id, o.id)} tone="teal">{o.name}</Chip>)}
                <input value={newOpt[g.id] || ""} onChange={(e) => setNewOpt({ ...newOpt, [g.id]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addOption(g); }} placeholder="+ nova opção" className="px-2.5 py-1 rounded-lg border border-dashed border-slate-300 text-xs w-36 focus:outline-none focus:border-teal-400" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Variações do produto</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {draft.variations.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-700">{v}<button onClick={() => setDraft({ ...draft, variations: draft.variations.filter((x) => x !== v) })} className="text-slate-400 hover:text-rose-600"><X className="w-3 h-3" /></button></span>
            ))}
            <input value={newVar} onChange={(e) => setNewVar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newVar.trim()) { setDraft({ ...draft, variations: [...draft.variations, newVar.trim()] }); setNewVar(""); } }} placeholder="Ex: Com braço, Sem braço, Banqueta…" className="px-2.5 py-1 rounded-lg border border-dashed border-slate-300 text-xs w-56 focus:outline-none focus:border-teal-400" />
          </div>
          <p className="text-xs font-medium text-slate-500 mt-4">Categoria / local de uso</p>
          <input value={draft.category || ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Ex: Colaborativo, Assentos, Outdoor…" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Descrição da peça</p>
          <textarea value={draft.pieceDescription || ""} onChange={(e) => setDraft({ ...draft, pieceDescription: e.target.value })} rows={4} placeholder="Texto de apresentação do produto, como aparece no site da marca." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </Card>
      </div>
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Onde vai cada material</p>
        <textarea value={draft.applicationNotes || ""} onChange={(e) => setDraft({ ...draft, applicationNotes: e.target.value })} rows={4} placeholder='Ex: "Base sempre preto fosco. Parte externa em pintura gofrato, tampo em melamina, interior nos tecidos."' className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
        {saved?.updatedAt && new Date(saved.updatedAt).getTime() > 0 && <p className="text-xs text-slate-400 mt-2">Última alteração: {new Date(saved.updatedAt).toLocaleString("pt-BR")}{saved.updatedBy ? ` por ${saved.updatedBy}` : ""}{saved.notionUrl ? <> · <a href={saved.notionUrl} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">origem no Notion</a></> : null}</p>}
      </Card>
      {dirty && can(user, "finishes", "edit") && <div className="sticky bottom-4 flex justify-end"><button onClick={save} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-lg hover:bg-slate-800">Salvar acabamentos</button></div>}
    </div>
  );
}

/** Tela "Acabamentos": catálogo da marca (grupos e opções) + situação por produto. */
function FinishesPage({ user, setPage, setSelectedBlock }: { user: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void }) {
  const { blocks, clients } = useContext(AppContext);
  const { catalogFor, forBlock, upsert } = useFinishes();
  const isClient = user.role === "client";
  const brands = isClient ? clients.filter((c) => c.id === user.clientId) : clients.filter((c) => blocks.some((b) => b.clientId === c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const [clientId, setClientId] = useState(isClient ? user.clientId || "" : brands[0]?.id || "");
  const catalog = catalogFor(clientId);
  const [draft, setDraft] = useState<FinishCatalog>(catalog);
  const [newGroup, setNewGroup] = useState("");
  const [newOpt, setNewOpt] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  useEffect(() => { setDraft(catalogFor(clientId)); }, [clientId, catalog.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify({ ...draft, updatedAt: "" }) !== JSON.stringify({ ...catalog, updatedAt: "" });

  const products = blocks.filter((b) => b.clientId === clientId && b.status !== "archived").sort((a, b) => a.title.localeCompare(b.title));
  const done = products.filter((b) => isFilled(forBlock(b.id)));
  const listed = products.filter((b) => (filter === "all" ? true : filter === "done" ? isFilled(forBlock(b.id)) : !isFilled(forBlock(b.id))));

  const addGroup = (name: string) => {
    const n = name.trim(); if (!n || draft.groups.some((g) => g.name.toLowerCase() === n.toLowerCase())) return;
    setDraft({ ...draft, groups: [...draft.groups, { id: `${slugId(n)}-${Date.now().toString(36)}`, name: n, options: [] }] }); setNewGroup("");
  };
  const addOption = (gid: string) => {
    const n = (newOpt[gid] || "").trim(); if (!n) return;
    setDraft({ ...draft, groups: draft.groups.map((g) => (g.id === gid ? { ...g, options: [...g.options, { id: `${slugId(n)}-${Date.now().toString(36)}`, name: n }] } : g)) });
    setNewOpt({ ...newOpt, [gid]: "" });
  };
  const save = () => upsert({ ...draft, id: catalogId(clientId), kind: "catalog", clientId, updatedAt: new Date().toISOString(), updatedBy: user.name });

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isClient ? "Portal do cliente" : "Produção · Acabamentos"}
        title="Acabamentos"
        description="O catálogo de acabamentos da marca (tecidos, madeiras, pinturas…) e, produto a produto, o que vai em cada parte. É o que a equipe usa para texturizar e programar o customizador."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {!isClient && (
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600">
                {brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <Badge className="border-slate-200/80 bg-white/80 text-slate-600">{done.length} de {products.length} produtos cadastrados</Badge>
          </div>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Catálogo da marca</p>
            <p className="text-sm text-slate-500 mt-1">Grupos e opções disponíveis. Cada produto marca, dentro destes grupos, o que aceita.</p>
          </div>
          <div className="flex gap-2">
            {dirty && <button onClick={() => setDraft(catalog)} className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100">Descartar</button>}
            {can(user, "finishes", "edit") ? <button onClick={save} disabled={!dirty} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-30 hover:bg-slate-800">Salvar catálogo</button> : <span className="text-[11px] text-slate-400">Somente consulta</span>}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {draft.groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <input value={g.name} onChange={(e) => setDraft({ ...draft, groups: draft.groups.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)) })} className="flex-1 px-2 py-1 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-300 text-sm font-semibold text-slate-800 bg-transparent" />
                <span className="text-xs text-slate-400">{g.options.length} opç{g.options.length === 1 ? "ão" : "ões"}</span>
                <button onClick={() => { if (confirm(`Remover o grupo "${g.name}"? Os produtos perdem as marcações desse grupo.`)) setDraft({ ...draft, groups: draft.groups.filter((x) => x.id !== g.id) }); }} className="p-1 text-slate-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                {g.options.map((o) => (
                  <span key={o.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-700">{o.name}<button onClick={() => setDraft({ ...draft, groups: draft.groups.map((x) => (x.id === g.id ? { ...x, options: x.options.filter((y) => y.id !== o.id) } : x)) })} className="text-slate-400 hover:text-rose-600"><X className="w-3 h-3" /></button></span>
                ))}
                <input value={newOpt[g.id] || ""} onChange={(e) => setNewOpt({ ...newOpt, [g.id]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addOption(g.id); }} placeholder="+ opção (Enter)" className="px-2.5 py-1 rounded-lg border border-dashed border-slate-300 text-xs w-40 focus:outline-none focus:border-teal-400" />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addGroup(newGroup); }} placeholder="Novo grupo (Enter)" className="px-3 py-2 rounded-xl border border-slate-200 text-sm w-56" />
            {SUGGESTED_GROUPS.filter((sg) => !draft.groups.some((g) => g.name.toLowerCase() === sg.toLowerCase())).map((sg) => (
              <button key={sg} onClick={() => addGroup(sg)} className="text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-700">+ {sg}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Produtos</p>
          <div className="flex gap-2">
            {([["all", "Todos", products.length], ["pending", "Pendentes", products.length - done.length], ["done", "Cadastrados", done.length]] as const).map(([id, label, n]) => (
              <TabBtn key={id} active={filter === id} label={label} count={n} onClick={() => setFilter(id)} />
            ))}
          </div>
        </div>
        {listed.length === 0 ? <EmptyState icon={Filter} title="Nenhum produto aqui" /> : (
          <div className="divide-y divide-slate-100">
            {listed.map((b) => {
              const bf = forBlock(b.id); const filled = isFilled(bf);
              const nSel = bf ? Object.values(bf.selections).reduce((n, v) => n + v.length, 0) : 0;
              return (
                <button key={b.id} onClick={() => { setSelectedBlock(b.id); setPage("block_detail"); }} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50 rounded-lg px-2">
                  <Badge className={filled ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs" : "bg-amber-50 text-amber-700 border-amber-200 text-xs"}>{filled ? "Cadastrado" : "Pendente"}</Badge>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800 truncate">{b.title}</p><p className="text-xs text-slate-400 truncate">{b.sku}{bf?.variations.length ? ` · ${bf.variations.join(", ")}` : ""}</p></div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{nSel} opç{nSel === 1 ? "ão" : "ões"}</span>
                  <StatusBadge status={b.status} />
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// NOTIFICAÇÕES — derivadas do estado, por perfil (sem tabela)
// ============================================================
interface Notif { key: string; title: string; desc?: string; tone: "info" | "warn" | "danger" | "ok"; go: () => void }

function NotificationsMenu({ currentUser, setPage, setSelectedBlock }: { currentUser: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void }) {
  const { blocks, tickets, activities, publications, bimDemands, finishes } = useContext(AppContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seenKey = `att_notif_seen_${currentUser.id}`;
  const [seen, setSeen] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch { return []; } });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const goBlock = (id: string) => { setSelectedBlock(id); setPage("block_detail"); };
  const dayMs = 86400000; const now = Date.now();
  const items: Notif[] = [];
  const role = currentUser.role;

  if (role === "freelancer_bim") {
    const mine = bimDemands.filter((d) => d.freelancerId === currentUser.id && bimIsOpen(d));
    mine.filter((d) => bimDaysLeft(d) < 0).forEach((d) => items.push({ key: `bim-late:${d.id}:${d.dueAt}`, title: `Atrasada: ${d.title}`, desc: `Prazo era ${fmtDate(d.dueAt)}`, tone: "danger", go: () => setPage("bim_minhas") }));
    mine.filter((d) => d.status === "not_started").forEach((d) => items.push({ key: `bim-new:${d.id}`, title: `Nova demanda: ${d.title}`, desc: `${d.productCount} produto${d.productCount === 1 ? "" : "s"} · prazo ${fmtDate(d.dueAt)}`, tone: "info", go: () => setPage("bim_minhas") }));
  } else if (role === "client") {
    const mine = blocks.filter((b) => b.clientId === currentUser.clientId);
    mine.filter((b) => ["awaiting_client_files", "awaiting_client_material_validation", "awaiting_client_final_validation"].includes(b.status)).forEach((b) =>
      items.push({ key: `await:${b.id}:${b.status}`, title: b.status === "awaiting_client_files" ? `Envie os arquivos: ${b.title}` : `Aguardando sua aprovação: ${b.title}`, desc: STATUS_LABELS[b.status], tone: "warn", go: () => goBlock(b.id) }));
    const noFin = mine.filter((b) => b.status !== "archived" && !isFilled(finishes.find((f) => f.kind === "block" && (f as BlockFinishes).blockId === b.id) as BlockFinishes | undefined));
    if (noFin.length) items.push({ key: `fin:${noFin.length}`, title: `${noFin.length} produto${noFin.length === 1 ? "" : "s"} sem acabamentos cadastrados`, desc: "Diga o que vai em cada parte do produto", tone: "info", go: () => setPage("finishes") });
    publications.filter((p) => { const b = mine.find((x) => x.id === p.blockId); return b?.published && now - new Date(b.published).getTime() < 14 * dayMs; })
      .forEach((p) => { const b = mine.find((x) => x.id === p.blockId)!; items.push({ key: `pub:${p.id}`, title: `Publicado: ${b.title}`, desc: `No ar desde ${fmtDate(b.published!)}`, tone: "ok", go: () => setPage("publications") }); });
  } else {
    const awaiting = blocks.filter(isAwaitingClient);
    if (awaiting.length) items.push({ key: `approvals:${awaiting.length}`, title: `${awaiting.length} bloco${awaiting.length === 1 ? "" : "s"} aguardando o cliente`, desc: "Validação de material ou final pendente", tone: "warn", go: () => setPage("approvals") });
    const blocked = blocks.filter((b) => b.status === "blocked");
    if (blocked.length) items.push({ key: `blocked:${blocked.length}`, title: `${blocked.length} bloco${blocked.length === 1 ? "" : "s"} bloqueado${blocked.length === 1 ? "" : "s"}`, tone: "danger", go: () => setPage("blocks") });
    const risky = tickets.filter((t) => isOpenTicket(t) && (new Date(t.slaDate).getTime() - now) / dayMs <= 3);
    if (risky.length) items.push({ key: `sla:${risky.map((t) => t.id).join(",")}`, title: `${risky.length} ticket${risky.length === 1 ? "" : "s"} com SLA em risco`, desc: risky.slice(0, 2).map((t) => t.title).join(" · "), tone: "danger", go: () => setPage("tickets") });
    const unassigned = tickets.filter((t) => isOpenTicket(t) && !t.assignedTo);
    if (unassigned.length) items.push({ key: `unassigned:${unassigned.length}`, title: `${unassigned.length} ticket${unassigned.length === 1 ? "" : "s"} sem responsável`, tone: "warn", go: () => setPage("tickets") });
    const delivered = bimDemands.filter((d) => d.status === "delivered");
    if (delivered.length) items.push({ key: `bim-deliv:${delivered.map((d) => d.id).join(",")}`, title: `${delivered.length} entrega${delivered.length === 1 ? "" : "s"} BIM aguardando aprovação`, desc: delivered.slice(0, 2).map((d) => d.title).join(" · "), tone: "ok", go: () => setPage("bim") });
    const late = bimDemands.filter((d) => bimIsOpen(d) && bimDaysLeft(d) < 0);
    if (late.length) items.push({ key: `bim-late:${late.map((d) => d.id).join(",")}`, title: `${late.length} demanda${late.length === 1 ? "" : "s"} BIM atrasada${late.length === 1 ? "" : "s"}`, tone: "danger", go: () => setPage("bim") });
    const waiting = bimDemands.filter((d) => d.status === "waiting_info");
    if (waiting.length) items.push({ key: `bim-wait:${waiting.map((d) => d.id).join(",")}`, title: `Terceirizado pediu informação em ${waiting.length} demanda${waiting.length === 1 ? "" : "s"}`, desc: waiting.slice(0, 2).map((d) => d.title).join(" · "), tone: "warn", go: () => setPage("bim") });
    activities.filter((a) => !isNavigation(a) && a.userId !== currentUser.id && now - new Date(a.at).getTime() < dayMs).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
      .forEach((a) => { const b = blocks.find((x) => x.id === a.blockId); items.push({ key: `act:${a.id}`, title: a.desc, desc: `${actorName(a)}${b ? ` · ${b.title}` : ""}`, tone: "info", go: () => (b ? goBlock(b.id) : setPage("activity")) }); });
  }

  const unread = items.filter((i) => !seen.includes(i.key)).length;
  const openMenu = () => {
    const next = !open; setOpen(next);
    if (next) { const all = Array.from(new Set([...seen, ...items.map((i) => i.key)])).slice(-300); setSeen(all); try { localStorage.setItem(seenKey, JSON.stringify(all)); } catch { /* ignore */ } }
  };
  const toneCls = { info: "bg-sky-500", warn: "bg-amber-500", danger: "bg-rose-500", ok: "bg-emerald-500" } as const;

  return (
    <div className="relative" ref={ref}>
      <button onClick={openMenu} title="Notificações" className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm transition hover:text-slate-700">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Notificações</p>
            <span className="text-xs text-slate-400">{items.length === 0 ? "nada pendente" : `${items.length} item${items.length === 1 ? "" : "s"}`}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Tudo em dia. Quando algo precisar de você, aparece aqui.</div>
            ) : items.map((i) => (
              <button key={i.key} onClick={() => { setOpen(false); i.go(); }} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0">
                <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${toneCls[i.tone]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 leading-snug">{i.title}</p>
                  {i.desc && <p className="text-xs text-slate-500 mt-0.5 truncate">{i.desc}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FASE 7 — PUBLICAÇÕES
// ============================================================
function PublicationFormModal({ title, onClose, onSave, initial, blocks }: {
  title: string; onClose: () => void;
  onSave: (d: { id?: string; blockId: string; url: string; v: number }) => void;
  initial?: SeedPub; blocks: SeedBlock[];
}) {
  const publishedBlocks = blocks.filter((b) => b.status === "published");
  const [blockId, setBlockId] = useState(initial?.blockId ?? publishedBlocks[0]?.id ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [v, setV] = useState(String(initial?.v ?? 1));
  const canSave = blockId && url.trim().startsWith("http");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-slate-500">Bloco *</label>
            <select value={blockId} onChange={(e) => setBlockId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
              {publishedBlocks.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.sku})</option>)}
            </select>
          </div>
          <div><label className="text-xs font-medium text-slate-500">URL do customizador *</label><input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono" placeholder="https://explorar.archtechtour.com/cliente/ver-N/produto/index.html" /></div>
          <div><label className="text-xs font-medium text-slate-500">Versão</label><input type="number" value={v} onChange={(e) => setV(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onSave({ id: initial?.id, blockId, url: url.trim(), v: Number(v) })} disabled={!canSave} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-30 hover:bg-slate-800">Salvar</button>
        </div>
      </div>
    </div>
  );
}

/** Modelo oficial do embed: as permissões são o que liga câmera/giroscópio (AR) e tela cheia dentro do iframe. */
const EMBED_TEMPLATE = '<iframe width="100%" height="640px" frameborder="0" src="SUBSTITUA O LINK DO PRODUTO AQUI" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>';

/** Instruções de uso dos embeds (texto que a Jéssica mantinha no Notion, "Cadastro de Produtos"). */
function EmbedInstructions({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(EMBED_TEMPLATE).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <Card className="p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold text-slate-800">Como colocar o customizador no seu site</p>
          <p className="mt-0.5 text-xs text-slate-500">Passo a passo do embed por iFrame — vale para todos os produtos abaixo.</p>
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
          <p>O customizador deve ser implementado na <b>página do respectivo produto</b> do seu site, a partir de um embed de iFrame.</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Copie o link do produto no card abaixo (ícone de copiar ao lado do endereço).</li>
            <li>Cole o link no lugar de <span className="font-mono text-[12px] text-rose-600">SUBSTITUA O LINK DO PRODUTO AQUI</span> no código-modelo:</li>
          </ol>
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <code className="min-w-0 flex-1 break-all font-mono text-[12px] leading-5 text-slate-700">{EMBED_TEMPLATE}</code>
            <button onClick={copy} className="flex-shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300">{copied ? "Copiado ✓" : "Copiar modelo"}</button>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5" start={3}>
            <li>Ou copie direto o <b>código do embed</b> já pronto de cada produto (segundo campo do card) — ele já vem com o link certo.</li>
            <li>Insira o código na página do produto num <b>bloco HTML</b> do seu site (normalmente representado pelo ícone <span className="font-mono">&lt;/&gt;</span>).</li>
          </ol>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">Pronto! Seu produto já está rodando no seu site, com customizador em tempo real, catálogo de acabamentos, blocos para especificação e realidade aumentada.</p>
          <p className="text-xs text-slate-500">Importante: mantenha o atributo <span className="font-mono">allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"</span> — sem ele a realidade aumentada e a tela cheia não funcionam dentro do iFrame. A altura (<span className="font-mono">height</span>) pode ser ajustada ao layout da página.</p>
        </div>
      )}
    </Card>
  );
}

function PublicationsPage({ user }: { user: SeedUser }) {
  const { blocks, setBlocks, setTickets, publications, setPublications, clients, currentUser } = useContext(AppContext);
  const [showImport, setShowImport] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SeedPub | null>(null);
  // Permissões vêm do perfil de acesso (src/lib/access.ts).
  const canCreate = can(currentUser, "publications", "create");
  const canEdit = can(currentUser, "publications", "edit");
  const canDelete = can(currentUser, "publications", "delete");
  const [filterClient, setFilterClient] = useState<string>("");

  const isClient = user.role === "client";
  const pubs = publications.filter((p) => {
    const block = blocks.find((b) => b.id === p.blockId);
    if (isClient) return block?.clientId === user.clientId;
    if (filterClient) return block?.clientId === filterClient;
    return true;
  });
  // Marcas que têm publicação (para o seletor)
  const marcasComPub = clients.filter((c) => publications.some((p) => blocks.find((b) => b.id === p.blockId)?.clientId === c.id));

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 2000); });
  };

  const handleSave = (d: { id?: string; blockId: string; url: string; v: number }) => {
    const embed = `<iframe width="100%" height="640px" frameborder="0" src="${d.url}" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>`;
    if (d.id) {
      setPublications(publications.map((p) => p.id === d.id ? { ...p, blockId: d.blockId, url: d.url, embed, v: d.v } : p));
    } else {
      setPublications([...publications, { id: `pub_${Date.now()}`, blockId: d.blockId, url: d.url, embed, env: "production", v: d.v }]);
    }
    setShowAdd(false); setEditing(null);
  };
  const handleDelete = (id: string) => {
    if (!confirm("Remover esta publicação?")) return;
    setPublications(publications.filter((p) => p.id !== id));
  };

  const embedFor = (url: string) => `<iframe width="100%" height="640px" frameborder="0" src="${url}" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>`;
  // Importação em lote (Liles, 2026-09-21): um TXT com os links vira publicações
  // já ligadas ao bloco e à marca certos. Bloco que já tinha link tem o link trocado.
  const applyImport = (rows: LinkImportRow[], markPublished: boolean) => {
    const byPub = new Map(rows.filter((r) => r.existingPubId).map((r) => [r.existingPubId!, r]));
    const novos: SeedPub[] = rows.filter((r) => !r.existingPubId).map((r, i) => ({ id: `pub_${Date.now()}_${i}`, blockId: r.blockId, url: r.url, embed: embedFor(r.url), env: "production", v: r.v }));
    setPublications([...publications.map((p) => { const r = byPub.get(p.id); return r ? { ...p, url: r.url, embed: embedFor(r.url), v: r.v } : p; }), ...novos]);
    if (markPublished) {
      const ids = new Set(rows.map((r) => r.blockId));
      const changed = blocks.filter((b) => ids.has(b.id) && b.status !== "published").map((b) => withStatus(b, "published"));
      const byId = new Map(changed.map((b) => [b.id, b]));
      setBlocks(blocks.map((b) => byId.get(b.id) ?? b));
      setTickets((prev) => changed.reduce((acc, b) => syncTicketsWithBlock(acc, b), prev));
    }
    setImportMsg(`${novos.length} publicação(ões) criada(s) e ${byPub.size} link(s) atualizado(s)${markPublished ? " · blocos marcados como Publicado" : ""}.`);
    setTimeout(() => setImportMsg(""), 8000);
    logActivity({ type: "import", entity: "publications", desc: `Importou ${rows.length} link(s) por TXT (${novos.length} novas, ${byPub.size} atualizadas)` });
  };

  // Baixa os links das publicações em TXT — todas as marcas ou só a filtrada.
  // Agrupado por marca, um link por linha, para colar em e-mail/WhatsApp.
  const exportTxt = () => {
    const brandName = filterClient ? getClientName(filterClient) : isClient ? getClientName(user.clientId!) : "";
    const groups = new Map<string, string[]>();
    pubs.forEach((p) => {
      const b = blocks.find((x) => x.id === p.blockId);
      const marca = b ? getClientName(b.clientId) : "Sem marca";
      const label = b ? `#${b.n} · ${b.title}${b.sku ? ` (${b.sku})` : ""}` : p.blockId;
      if (!groups.has(marca)) groups.set(marca, []);
      groups.get(marca)!.push(`${label}\n${p.url}`);
    });
    const hoje = new Date().toLocaleDateString("pt-BR");
    const linhas: string[] = [
      `ArchTechTour · Links dos customizadores${brandName ? ` · ${brandName}` : " · todas as marcas"}`,
      `Gerado em ${hoje} · ${pubs.length} publicação(ões)`,
      "",
    ];
    Array.from(groups.keys()).sort((a, b) => a.localeCompare(b)).forEach((marca) => {
      const itens = groups.get(marca)!;
      linhas.push(`==== ${marca} (${itens.length}) ====`, "");
      itens.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })).forEach((it) => linhas.push(it, ""));
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (brandName || "todas-as-marcas").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    a.href = url; a.download = `links-archtechtour-${slug}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    logActivity({ type: "export", entity: "publications", clientId: filterClient || user.clientId, desc: `Baixou os links em TXT (${brandName || "todas as marcas"}, ${pubs.length} publicações)` });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Fase 7 · Publicação"
        title="Blocos publicados"
        description="Todos os blocos 3D disponíveis na plataforma ArchTechTour, com links de embed."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {!isClient && (
              <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600">
                <option value="">Todas as marcas</option>
                {marcasComPub.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <Badge className="border-slate-200/80 bg-white/80 text-slate-600">{pubs.length} publicados</Badge>
            {pubs.length > 0 && (
              <button onClick={exportTxt} title="Baixa um .txt com os links dos customizadores (todas as marcas ou só a marca filtrada)" className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition">
                <FileText className="w-3.5 h-3.5" /> Baixar links (.txt)
              </button>
            )}
            {canCreate && canEdit && (
              <button onClick={() => setShowImport(true)} title="Cola ou sobe um .txt com os links do explorar; o portal liga cada um ao bloco e à marca" className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition">
                <Upload className="w-3.5 h-3.5" /> Importar links (.txt)
              </button>
            )}
            {canCreate && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:brightness-110 transition"><Plus className="w-3.5 h-3.5" /> Nova Publicação</button>}
          </div>
        }
      />

      {showImport && <LinkImportModal blocks={blocks} clients={clients} publications={publications} statusLabel={(st) => STATUS_LABELS[st as BlockStatus] ?? st ?? ""} onClose={() => setShowImport(false)} onApply={applyImport} />}
      {importMsg && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{importMsg}</div>}
      <EmbedInstructions defaultOpen={isClient} />

      {pubs.length === 0 ? (
        <Card className="p-4"><EmptyState icon={Globe} title="Nenhuma publicação ainda" desc={canCreate ? "Clique em 'Nova Publicação' para adicionar manualmente." : "Seus blocos aparecerão aqui após aprovação e publicação pela equipe ArchTechTour."} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pubs.map((pub) => {
            const block = blocks.find((b) => b.id === pub.blockId);
            const client = clients.find((c) => c.id === block?.clientId);
            return (
              <Card key={pub.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{client?.name} · v{pub.v}</p>
                    <h4 className="text-base font-semibold text-slate-900 mt-1">{block?.title || pub.blockId}</h4>
                    <Badge className="mt-2 border-emerald-200/80 bg-emerald-50 text-emerald-700">Publicado</Badge>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex gap-1">
                      {canEdit && <button onClick={() => setEditing(pub)} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100"><Settings className="w-3.5 h-3.5 text-slate-400" /></button>}
                      {canDelete && <button onClick={() => handleDelete(pub.id)} title="Remover" className="p-1.5 rounded-lg hover:bg-red-50"><X className="w-3.5 h-3.5 text-red-500" /></button>}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <p className="flex-1 min-w-0 truncate text-xs text-slate-600">{pub.url}</p>
                    <div className="flex gap-1">
                      <button onClick={() => copyToClipboard(pub.url, `url-${pub.id}`)} className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-slate-200 transition text-slate-400 hover:text-slate-700">
                        {copied === `url-${pub.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <a href={pub.url} target="_blank" rel="noopener noreferrer" className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-slate-200 transition text-slate-400 hover:text-slate-700">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Hash className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <p className="flex-1 min-w-0 truncate text-xs text-slate-600 font-mono">{pub.embed.slice(0, 60)}…</p>
                    <button onClick={() => copyToClipboard(pub.embed, `embed-${pub.id}`)} className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-slate-200 transition text-slate-400 hover:text-slate-700">
                      {copied === `embed-${pub.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {showAdd && <PublicationFormModal title="Nova Publicação" onClose={() => setShowAdd(false)} onSave={handleSave} blocks={blocks} />}
      {editing && <PublicationFormModal title="Editar Publicação" onClose={() => setEditing(null)} onSave={handleSave} initial={editing} blocks={blocks} />}
    </div>
  );
}

// ============================================================
// AGENTES AI (admin only)
// ============================================================
interface AgentDef {
  id: string;
  name: string;
  role: string;
  description: string;
  page: string;
  color: string;
  active: boolean;
}

const AGENTS: AgentDef[] = [
  {
    id: "sherlock-codes",
    name: "Sherlock Codes",
    role: "Caçador de Bugs",
    description: "Detective técnico: caça bugs e problemas de integridade no banco de dados. IDs órfãos, contadores divergentes, referências quebradas, duplicatas. Não opina sobre projetos ou customizadores.",
    page: "agent_sherlock_codes",
    color: "from-amber-400 to-orange-500",
    active: true,
  },
  {
    id: "monk-lighthouse",
    name: "Monk Lighthouse",
    role: "QA dos Customizadores",
    description: "Audita cada customizador 3D publicado: HTTP, script de analytics, links de download corretos, zoom/escala desabilitados, AR funcionando. Pode rodar em todos os clientes ou em um específico.",
    page: "agent_monk_lighthouse",
    color: "from-teal-400 to-cyan-500",
    active: true,
  },
  {
    id: "yoda-kanban",
    name: "Yoda Kanban",
    role: "Gerente de Projetos",
    description: "Analisa a saúde do projeto de cada cliente: progresso, riscos, oportunidades, próximas ações para a PM (Jessica). Sugere expansão, renovação, alertas de cliente parado. Pode focar em um cliente específico para análise profunda.",
    page: "agent_yoda_kanban",
    color: "from-emerald-400 to-green-600",
    active: true,
  },
  {
    id: "harvey-closer",
    name: "Harvey Closer",
    role: "Relação com Cliente · Comercial",
    description: "Transforma os dados de analytics em argumentos de valor e ações comerciais/marketing. Ajuda a reter clientes em risco de cancelamento, mostrando o ROI real e como o comercial da marca pode converter os leads (downloads, AR, WhatsApp). Gera resposta pronta pra enviar.",
    page: "agent_harvey_closer",
    color: "from-indigo-500 to-violet-600",
    active: true,
  },
  {
    id: "argus-watchtower",
    name: "Argus Watchtower",
    role: "Monitor de Disponibilidade",
    description: "Vigia se os sites da ATT estão no ar. Verifica automaticamente nos horários configurados (padrão: 13h e 21h, Brasília) e envia e-mail para a equipe dizendo se está tudo OK ou o que caiu. Horários, destinatários e sites monitorados são editáveis aqui.",
    page: "agent_argus_watchtower",
    color: "from-sky-400 to-blue-600",
    active: true,
  },
];

function AgentsPage({ setPage }: { setPage: (p: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Operação interna · IA"
        title="Agentes AI"
        description="Agentes inteligentes para auditoria, análise e automação operacional. Cada agente tem seu próprio contexto e missão."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((a) => (
          <Card key={a.id} className="p-5 hover:shadow-lg transition cursor-pointer" onClick={() => a.active && setPage(a.page)}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center shadow-lg`}>
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-slate-900">{a.name}</p>
                <p className="text-xs text-slate-500">{a.role}</p>
              </div>
              {a.active ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Ativo</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs">Em breve</Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{a.description}</p>
            {a.active && (
              <button className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-900 hover:text-slate-700">
                Abrir agente <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  tokens?: { input: number; output: number };
}

function SherlockCodesPage({ setPage }: { setPage: (p: string) => void }) {
  const [messages, setMessages] = useState<AgentMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("att_agent_sherlock_codes_history");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try { localStorage.setItem("att_agent_sherlock_codes_history", JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  const runAudit = async (userPrompt?: string) => {
    setLoading(true); setError("");
    const userMsg: AgentMessage = {
      role: "user",
      content: userPrompt || "Faça uma auditoria completa do portal.",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    try {
      const res = await fetch("/api/agents/sherlock-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt }),
      });
      const raw = await res.text();
      let data: { ok?: boolean; report?: string; error?: string; timestamp?: string; tokens?: { input: number; output: number } } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error(raw.slice(0, 200) || `HTTP ${res.status} — resposta vazia (provável timeout do Lambda)`);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.report) throw new Error("Resposta sem conteúdo");
      const assistantMsg: AgentMessage = {
        role: "assistant",
        content: data.report,
        timestamp: data.timestamp || new Date().toISOString(),
        tokens: data.tokens,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      logActivity({ type: "agent_run", entity: "agents", entityId: "sherlock-codes", desc: `Rodou o agente Sherlock Codes${userPrompt ? ` · "${userPrompt.slice(0, 80)}"` : ""}` });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (!confirm("Limpar histórico de auditorias?")) return;
    setMessages([]);
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setPage("agents")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Sherlock Codes</h1>
            <p className="text-sm text-slate-500">Auditor do Portal · {messages.length} mensagens</p>
          </div>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && <button onClick={clearHistory} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">Limpar</button>}
          <button onClick={() => runAudit()} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50">
            {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Auditando…</> : <><Zap className="w-3.5 h-3.5" /> Auditoria completa</>}
          </button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" /><div><p className="text-sm font-semibold text-red-700">Erro</p><p className="text-xs text-red-600 mt-1">{error}</p></div></div>
        </Card>
      )}

      {messages.length === 0 && !loading && (
        <Card className="p-8">
          <EmptyState icon={Bot} title="Pronto para auditar" desc="Clique em 'Auditoria completa' ou faça uma pergunta específica abaixo." />
          <div className="mt-4 grid gap-2 max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Sugestões</p>
            {[
              "Por que o painel da RS Design está vazio para o cliente?",
              "Quais clientes têm blocos publicados sem URL de publicação cadastrada?",
              "Liste tickets com SLA vencido e sem responsável.",
              "Quais contratos têm usedBlocks diferente da contagem real de blocos?",
            ].map((s) => (
              <button key={s} onClick={() => runAudit(s)} className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700">{s}</button>
            ))}
          </div>
        </Card>
      )}

      {messages.map((m, i) => (
        <Card key={i} className={`p-5 ${m.role === "user" ? "bg-slate-50 border-slate-200" : "bg-white"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-slate-200" : "bg-gradient-to-br from-amber-400 to-orange-500"}`}>
              {m.role === "user" ? <UserCheck className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500">{m.role === "user" ? "Você" : "Sherlock Codes"}</p>
                <p className="text-xs text-slate-400">{new Date(m.timestamp).toLocaleString("pt-BR")}{m.tokens && ` · ${m.tokens.input}+${m.tokens.output} tokens`}</p>
              </div>
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          </div>
        </Card>
      ))}

      {loading && (
        <Card className="p-5">
          <div className="flex items-center gap-3"><RefreshCw className="w-4 h-4 animate-spin text-amber-500" /><p className="text-sm text-slate-600">Sherlock Codes está auditando o portal…</p></div>
        </Card>
      )}

      <div className="flex gap-2 sticky bottom-4">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !loading) runAudit(prompt); }}
          placeholder="Pergunte algo específico ao Sherlock Codes…"
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-amber-400 shadow-sm"
        />
        <button onClick={() => prompt.trim() && runAudit(prompt)} disabled={!prompt.trim() || loading} className="px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-30">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function MonkLighthousePage({ setPage }: { setPage: (p: string) => void }) {
  const { clients } = useContext(AppContext);
  const [messages, setMessages] = useState<AgentMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("att_agent_monk_lighthouse_history") || "[]"); } catch { return []; }
  });
  const [prompt, setPrompt] = useState("");
  const [scopeClient, setScopeClient] = useState<string>(""); // "" = todos
  const [auditUrl, setAuditUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { try { localStorage.setItem("att_agent_monk_lighthouse_history", JSON.stringify(messages)); } catch { /* ignore */ } }, [messages]);

  const runAudit = async (userPrompt?: string) => {
    setLoading(true); setError("");
    let scopeLabel: string;
    if (auditUrl.trim()) scopeLabel = `URL específica (${auditUrl.trim().slice(0, 60)})`;
    else if (scopeClient) scopeLabel = clients.find((c) => c.id === scopeClient)?.name || "cliente";
    else scopeLabel = "todos os clientes (10 produtos por rodada)";
    const userMsg: AgentMessage = {
      role: "user",
      content: userPrompt || `Auditoria de qualidade — escopo: ${scopeLabel}`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    try {
      const res = await fetch("/api/agents/monk-lighthouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userPrompt,
          clientId: !auditUrl.trim() && scopeClient ? scopeClient : undefined,
          url: auditUrl.trim() || undefined,
        }),
      });
      const raw = await res.text();
      let data: { report?: string; error?: string; timestamp?: string; tokens?: { input: number; output: number }; probes_count?: number } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error(raw.slice(0, 200) || `HTTP ${res.status} — resposta vazia (provável timeout)`);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.report) throw new Error("Resposta sem conteúdo");
      const assistantMsg: AgentMessage = {
        role: "assistant",
        content: `_${data.probes_count} customizadores analisados._\n\n${data.report}`,
        timestamp: data.timestamp || new Date().toISOString(),
        tokens: data.tokens,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      logActivity({ type: "agent_run", entity: "agents", entityId: "monk-lighthouse", clientId: scopeClient || undefined, desc: `Rodou o agente Monk Lighthouse · ${scopeLabel}` });
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };

  const clearHistory = () => { if (confirm("Limpar histórico?")) setMessages([]); };

  return (
    <div className="space-y-4">
      <button onClick={() => setPage("agents")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg"><Bot className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Monk Lighthouse</h1>
            <p className="text-sm text-slate-500">QA dos Customizadores · {messages.length} mensagens</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {messages.length > 0 && <button onClick={clearHistory} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">Limpar</button>}
          <button onClick={() => runAudit()} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50">
            {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Auditando…</> : <><Zap className="w-3.5 h-3.5" /> Auditar qualidade</>}
          </button>
        </div>
      </div>

      {/* Escopo da auditoria */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Escopo da auditoria</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500">URL específica (opcional)</label>
            <input
              value={auditUrl}
              onChange={(e) => setAuditUrl(e.target.value)}
              placeholder="https://explorar.archtechtour.com/cliente/ver-N/produto/index.html"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-teal-400"
            />
            <p className="text-xs text-slate-400 mt-1">Se preenchido, Monk audita só essa URL (ignora cliente abaixo).</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Cliente (default: todos)</label>
            <select value={scopeClient} onChange={(e) => setScopeClient(e.target.value)} disabled={!!auditUrl.trim()} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400">
              <option value="">Todos os clientes (10 produtos por rodada)</option>
              {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1">Para um cliente: até 10 produtos. Para mais, rode novamente.</p>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" /><div><p className="text-sm font-semibold text-red-700">Erro</p><p className="text-xs text-red-600 mt-1">{error}</p></div></div>
        </Card>
      )}

      {messages.length === 0 && !loading && (
        <Card className="p-8">
          <EmptyState icon={Bot} title="Pronto para auditar a qualidade" desc="Selecione um cliente (ou todos) e clique em 'Auditar qualidade'. Monk vai testar cada URL publicada." />
          <div className="mt-4 grid gap-2 max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Sugestões</p>
            {[
              "Quais customizadores têm links de download apontando para o produto errado?",
              "Liste produtos publicados que estão permitindo zoom/escala — esses não devem permitir.",
              "Quais customizadores estão sem o script de analytics?",
              "Algum produto sem suporte a AR/iOS (USDZ)?",
              "Faça uma auditoria detalhada apenas dos publicados recentes.",
              "Cole uma URL específica no campo acima para auditar só ela.",
            ].map((s) => (
              <button key={s} onClick={() => runAudit(s)} className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700">{s}</button>
            ))}
          </div>
        </Card>
      )}

      {messages.map((m, i) => (
        <Card key={i} className={`p-5 ${m.role === "user" ? "bg-slate-50 border-slate-200" : "bg-white"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-slate-200" : "bg-gradient-to-br from-teal-400 to-cyan-500"}`}>
              {m.role === "user" ? <UserCheck className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500">{m.role === "user" ? "Você" : "Monk Lighthouse"}</p>
                <p className="text-xs text-slate-400">{new Date(m.timestamp).toLocaleString("pt-BR")}{m.tokens && ` · ${m.tokens.input}+${m.tokens.output} tokens`}</p>
              </div>
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          </div>
        </Card>
      ))}

      {loading && (
        <Card className="p-5">
          <div className="flex items-center gap-3"><RefreshCw className="w-4 h-4 animate-spin text-teal-500" /><p className="text-sm text-slate-600">Monk está testando cada customizador (até 25 por auditoria)…</p></div>
        </Card>
      )}

      <div className="flex gap-2 sticky bottom-4">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !loading) runAudit(prompt); }}
          placeholder="Pergunte algo ao Monk Lighthouse…"
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-teal-400 shadow-sm"
        />
        <button onClick={() => prompt.trim() && runAudit(prompt)} disabled={!prompt.trim() || loading} className="px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-30"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function YodaKanbanPage({ setPage }: { setPage: (p: string) => void }) {
  const { clients } = useContext(AppContext);
  const [messages, setMessages] = useState<AgentMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("att_agent_yoda_kanban_history") || "[]"); } catch { return []; }
  });
  const [prompt, setPrompt] = useState("");
  const [scopeClient, setScopeClient] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { try { localStorage.setItem("att_agent_yoda_kanban_history", JSON.stringify(messages)); } catch { /* ignore */ } }, [messages]);

  const runAnalysis = async (userPrompt?: string) => {
    setLoading(true); setError("");
    const scopeLabel = scopeClient ? clients.find((c) => c.id === scopeClient)?.name || "cliente" : "portfólio completo";
    const userMsg: AgentMessage = {
      role: "user",
      content: userPrompt || `Análise de projeto — escopo: ${scopeLabel}`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    try {
      const res = await fetch("/api/agents/yoda-kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt, clientId: scopeClient || undefined }),
      });
      const raw = await res.text();
      let data: { report?: string; error?: string; timestamp?: string; tokens?: { input: number; output: number }; clients_analyzed?: number } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error(raw.slice(0, 200) || `HTTP ${res.status} — resposta vazia`);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.report) throw new Error("Resposta sem conteúdo");
      const assistantMsg: AgentMessage = {
        role: "assistant",
        content: `_${data.clients_analyzed} ${data.clients_analyzed === 1 ? "cliente analisado" : "clientes analisados"}._\n\n${data.report}`,
        timestamp: data.timestamp || new Date().toISOString(),
        tokens: data.tokens,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      logActivity({ type: "agent_run", entity: "agents", entityId: "yoda-kanban", clientId: scopeClient || undefined, desc: `Rodou o agente Yoda Kanban · ${scopeLabel}` });
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };

  const clearHistory = () => { if (confirm("Limpar histórico?")) setMessages([]); };

  return (
    <div className="space-y-4">
      <button onClick={() => setPage("agents")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg"><Bot className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Yoda Kanban</h1>
            <p className="text-sm text-slate-500">Gerente de Projetos · {messages.length} mensagens</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {messages.length > 0 && <button onClick={clearHistory} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">Limpar</button>}
          <button onClick={() => runAnalysis()} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-600 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50">
            {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analisando…</> : <><Zap className="w-3.5 h-3.5" /> Analisar projetos</>}
          </button>
        </div>
      </div>

      {/* Escopo */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Foco da análise</p>
        <div>
          <label className="text-xs font-medium text-slate-500">Cliente (default: todos)</label>
          <select value={scopeClient} onChange={(e) => setScopeClient(e.target.value)} className="mt-1 w-full md:w-1/2 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
            <option value="">Portfólio completo (todos clientes ativos)</option>
            {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-1">Foco em 1 cliente → análise profunda (saúde, riscos, oportunidades).</p>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" /><div><p className="text-sm font-semibold text-red-700">Erro</p><p className="text-xs text-red-600 mt-1">{error}</p></div></div>
        </Card>
      )}

      {messages.length === 0 && !loading && (
        <Card className="p-8">
          <EmptyState icon={Bot} title="Pronta para sua análise de portfólio" desc="Clique em 'Analisar projetos' para visão geral, ou selecione um cliente para análise profunda." />
          <div className="mt-4 grid gap-2 max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Sugestões</p>
            {[
              "Quais clientes estão em risco crítico (sem entregas, contrato avançado)?",
              "Mostre os clientes com maior potencial de expansão.",
              "Liste contratos próximos do limite de blocos (>80%).",
              "Que ações a Jessica deve priorizar esta semana?",
              "Como está o pace de entrega comparado por cliente?",
            ].map((s) => (
              <button key={s} onClick={() => runAnalysis(s)} className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700">{s}</button>
            ))}
          </div>
        </Card>
      )}

      {messages.map((m, i) => (
        <Card key={i} className={`p-5 ${m.role === "user" ? "bg-slate-50 border-slate-200" : "bg-white"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-slate-200" : "bg-gradient-to-br from-emerald-400 to-green-600"}`}>
              {m.role === "user" ? <UserCheck className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500">{m.role === "user" ? "Você" : "Yoda Kanban"}</p>
                <p className="text-xs text-slate-400">{new Date(m.timestamp).toLocaleString("pt-BR")}{m.tokens && ` · ${m.tokens.input}+${m.tokens.output} tokens`}</p>
              </div>
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          </div>
        </Card>
      ))}

      {loading && (
        <Card className="p-5">
          <div className="flex items-center gap-3"><RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /><p className="text-sm text-slate-600">Yoda está revisando os projetos…</p></div>
        </Card>
      )}

      <div className="flex gap-2 sticky bottom-4">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !loading) runAnalysis(prompt); }}
          placeholder="Pergunte algo ao Yoda…"
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-emerald-400 shadow-sm"
        />
        <button onClick={() => prompt.trim() && runAnalysis(prompt)} disabled={!prompt.trim() || loading} className="px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-30"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function HarveyCloserPage({ setPage }: { setPage: (p: string) => void }) {
  const { clients } = useContext(AppContext);
  const [messages, setMessages] = useState<AgentMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("att_agent_harvey_closer_history") || "[]"); } catch { return []; }
  });
  const [prompt, setPrompt] = useState("");
  const [scopeClient, setScopeClient] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { try { localStorage.setItem("att_agent_harvey_closer_history", JSON.stringify(messages)); } catch { /* ignore */ } }, [messages]);

  const run = async (userPrompt?: string) => {
    if (!scopeClient) { setError("Selecione um cliente primeiro."); return; }
    setLoading(true); setError("");
    const nome = clients.find((c) => c.id === scopeClient)?.name || "cliente";
    const userMsg: AgentMessage = {
      role: "user",
      content: userPrompt || `Estratégia de retenção e comercial — ${nome}`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    try {
      const res = await fetch("/api/agents/harvey-closer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt, clientId: scopeClient }),
      });
      const raw = await res.text();
      let data: { report?: string; error?: string; timestamp?: string; tokens?: { input: number; output: number }; has_analytics?: boolean } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error(raw.slice(0, 200) || `HTTP ${res.status} — resposta vazia`);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.report) throw new Error("Resposta sem conteúdo");
      const prefix = data.has_analytics ? "" : "_⚠️ Cliente sem cache de analytics — gere o relatório no Analytics primeiro para uma análise mais forte._\n\n";
      const assistantMsg: AgentMessage = {
        role: "assistant",
        content: prefix + data.report,
        timestamp: data.timestamp || new Date().toISOString(),
        tokens: data.tokens,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      logActivity({ type: "agent_run", entity: "agents", entityId: "harvey-closer", clientId: scopeClient, desc: `Rodou o agente Harvey Closer · ${nome}` });
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };

  const clearHistory = () => { if (confirm("Limpar histórico?")) setMessages([]); };

  return (
    <div className="space-y-4">
      <button onClick={() => setPage("agents")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg"><Bot className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Harvey Closer</h1>
            <p className="text-sm text-slate-500">Relação com Cliente · Comercial · {messages.length} mensagens</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {messages.length > 0 && <button onClick={clearHistory} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">Limpar</button>}
          <button onClick={() => run()} disabled={loading || !scopeClient} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50">
            {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analisando…</> : <><Zap className="w-3.5 h-3.5" /> Montar estratégia</>}
          </button>
        </div>
      </div>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Cliente em foco</p>
        <select value={scopeClient} onChange={(e) => setScopeClient(e.target.value)} className="w-full md:w-1/2 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
          <option value="">Selecione o cliente…</option>
          {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="text-xs text-slate-400 mt-1">Harvey cruza o analytics real + portfólio do cliente para montar a estratégia.</p>
      </Card>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" /><div><p className="text-sm font-semibold text-red-700">Erro</p><p className="text-xs text-red-600 mt-1">{error}</p></div></div>
        </Card>
      )}

      {messages.length === 0 && !loading && (
        <Card className="p-8">
          <EmptyState icon={Bot} title="Pronto para fechar o acordo" desc="Selecione um cliente e clique em 'Montar estratégia', ou faça uma pergunta específica." />
          <div className="mt-4 grid gap-2 max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Sugestões</p>
            {[
              "Cliente quer cancelar dizendo que não teve conversão. Como respondo?",
              "Monte um plano de ação comercial para o time de vendas dele usar os dados.",
              "Quais produtos ele deve destacar em campanha de marketing?",
              "Escreva uma resposta pronta pra eu enviar argumentando o valor.",
            ].map((s) => (
              <button key={s} onClick={() => run(s)} className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700">{s}</button>
            ))}
          </div>
        </Card>
      )}

      {messages.map((m, i) => (
        <Card key={i} className={`p-5 ${m.role === "user" ? "bg-slate-50 border-slate-200" : "bg-white"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-slate-200" : "bg-gradient-to-br from-indigo-500 to-violet-600"}`}>
              {m.role === "user" ? <UserCheck className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500">{m.role === "user" ? "Você" : "Harvey Closer"}</p>
                <p className="text-xs text-slate-400">{new Date(m.timestamp).toLocaleString("pt-BR")}{m.tokens && ` · ${m.tokens.input}+${m.tokens.output} tokens`}</p>
              </div>
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          </div>
        </Card>
      ))}

      {loading && (
        <Card className="p-5">
          <div className="flex items-center gap-3"><RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /><p className="text-sm text-slate-600">Harvey está montando a estratégia…</p></div>
        </Card>
      )}

      <div className="flex gap-2 sticky bottom-4">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !loading) run(prompt); }}
          placeholder="Pergunte algo ao Harvey…"
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 shadow-sm"
        />
        <button onClick={() => prompt.trim() && run(prompt)} disabled={!prompt.trim() || loading} className="px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-30"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Argus Watchtower — monitor de disponibilidade (Lambda site-watchdog)
// A rotina (horários, destinatários, alvos) vive no DynamoDB e é lida pela
// Lambda a cada hora — salvar aqui já muda o agendamento, sem redeploy.
// ------------------------------------------------------------
interface WatchTarget { id: string; label: string; url: string; mustContain?: string; enabled: boolean }
interface WatchRoutine {
  id: string; enabled: boolean; hours: number[]; recipients: string[]; sender: string;
  targets: WatchTarget[]; notifyWhen: "always" | "only_failure"; timeoutMs: number; retries: number;
  updatedAt: string; updatedBy?: string;
}
interface WatchResult {
  id: string; label: string; url: string; ok: boolean; httpStatus: number;
  finalUrl?: string; durationMs: number; attempts: number; error?: string;
}
interface WatchCheck {
  id: string; ranAt: string; trigger: "schedule" | "manual"; overallOk?: boolean;
  results?: WatchResult[]; emailSent?: boolean; emailError?: string; recipients?: string[]; running?: boolean;
}

function ArgusWatchtowerPage({ setPage }: { setPage: (p: string) => void }) {
  const { currentUser } = useContext(AppContext);
  const [routine, setRoutine] = useState<WatchRoutine | null>(null);
  const [draft, setDraft] = useState<WatchRoutine | null>(null);
  const [history, setHistory] = useState<WatchCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/agents/argus-watchtower");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRoutine(data.routine);
      setDraft(data.routine);
      setHistory(data.history || []);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = !!draft && !!routine && JSON.stringify({ ...draft, updatedAt: "" }) !== JSON.stringify({ ...routine, updatedAt: "" });

  const runNow = async (sendEmail: boolean) => {
    setRunning(true); setError(""); setOkMsg("");
    try {
      const res = await fetch("/api/agents/argus-watchtower", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const check: WatchCheck = data.check;
      setHistory((prev) => [check, ...prev]);
      logActivity({ type: "agent_run", entity: "agents", entityId: "argus-watchtower", desc: `Rodou o Argus Watchtower agora${sendEmail ? " (com e-mail)" : ""} · ${check.overallOk ? "tudo no ar" : "há alvo fora do ar"}` });
      if (sendEmail) {
        setOkMsg(check.emailSent
          ? `Verificação concluída e e-mail enviado para ${(check.recipients || []).join(", ")}.`
          : `Verificação concluída, mas o e-mail falhou: ${check.emailError}`);
      } else {
        setOkMsg(check.overallOk ? "Verificação concluída — tudo no ar." : "Verificação concluída — há alvo fora do ar.");
      }
    } catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true); setError(""); setOkMsg("");
    try {
      const res = await fetch("/api/agents/argus-watchtower/routine", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, updatedBy: currentUser?.name || currentUser?.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRoutine(data.routine); setDraft(data.routine);
      logActivity({ type: "agent_config", entity: "agents", entityId: "argus-watchtower", desc: `Salvou a rotina do Argus Watchtower · horários ${(data.routine?.hours || []).join("h, ")}h` });
      setOkMsg("Rotina salva. A partir de agora a Lambda usa estes horários e destinatários.");
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const patch = (p: Partial<WatchRoutine>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const toggleHour = (h: number) => patch({ hours: draft!.hours.includes(h) ? draft!.hours.filter((x) => x !== h) : [...draft!.hours, h].sort((a, b) => a - b) });
  const patchTarget = (i: number, p: Partial<WatchTarget>) => patch({ targets: draft!.targets.map((t, idx) => (idx === i ? { ...t, ...p } : t)) });

  const last = history.find((h) => h.results && h.results.length > 0);
  const nextHour = useMemo(() => {
    if (!routine?.enabled || !routine.hours.length) return null;
    const spHour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date())) % 24;
    return routine.hours.find((h) => h > spHour) ?? routine.hours[0];
  }, [routine]);

  return (
    <div className="space-y-4">
      <button onClick={() => setPage("agents")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg"><Bot className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Argus Watchtower</h1>
            <p className="text-sm text-slate-500">
              Monitor de disponibilidade · {routine?.enabled ? `rotina ativa às ${routine.hours.map((h) => `${String(h).padStart(2, "0")}h`).join(" e ")} (Brasília)` : "rotina desativada"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => runNow(false)} disabled={running || loading} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Verificar sem e-mail</button>
          <button onClick={() => runNow(true)} disabled={running || loading} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50">
            {running ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verificando…</> : <><Zap className="w-3.5 h-3.5" /> Verificar e enviar e-mail</>}
          </button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" /><div><p className="text-sm font-semibold text-red-700">Erro</p><p className="text-xs text-red-600 mt-1">{error}</p></div></div>
        </Card>
      )}
      {okMsg && (
        <Card className="p-4 border-emerald-200 bg-emerald-50">
          <div className="flex items-start gap-3"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /><p className="text-sm text-emerald-700">{okMsg}</p></div>
        </Card>
      )}

      {loading && <Card className="p-5"><div className="flex items-center gap-3"><RefreshCw className="w-4 h-4 animate-spin text-sky-500" /><p className="text-sm text-slate-600">Carregando rotina e histórico…</p></div></Card>}

      {/* Situação atual */}
      {!loading && (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Última verificação</p>
              {last ? (
                <>
                  <p className={`mt-1 text-lg font-bold ${last.overallOk ? "text-emerald-600" : "text-red-600"}`}>{last.overallOk ? "Tudo no ar" : "Falha detectada"}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(last.ranAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {last.trigger === "manual" ? "manual" : "automática"}
                    {last.emailSent ? " · e-mail enviado" : last.emailError ? " · e-mail falhou" : ""}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Nenhuma verificação registrada ainda.</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Próxima automática</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{nextHour !== null ? `${String(nextHour).padStart(2, "0")}h` : "—"}</p>
              <p className="text-xs text-slate-500">horário de Brasília</p>
            </div>
          </div>
          {last?.results && (
            <div className="mt-4 space-y-2">
              {last.results.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <Badge className={r.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs" : "bg-red-50 text-red-700 border-red-200 text-xs"}>{r.ok ? "OK" : "FALHA"}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.label}</p>
                    <p className="text-xs text-slate-400 truncate">{r.url}</p>
                  </div>
                  <p className="text-xs text-slate-500 whitespace-nowrap">{r.ok ? `HTTP ${r.httpStatus} · ${r.durationMs}ms` : `${r.error} · ${r.attempts} tent.`}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Editor da rotina */}
      {draft && (
        <Card className="p-5 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rotina do agente</p>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="w-4 h-4 accent-sky-500" />
              Verificação automática ligada
            </label>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Horários (Brasília) — clique para ligar/desligar</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: 24 }, (_, h) => (
                <button key={h} onClick={() => toggleHour(h)} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${draft.hours.includes(h) ? "bg-sky-500 text-white border-sky-500" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                  {String(h).padStart(2, "0")}h
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">A Lambda acorda de hora em hora e só roda nos horários marcados — mudar aqui já vale para a próxima hora.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Destinatários (um por linha)</label>
              <textarea
                value={draft.recipients.join("\n")}
                onChange={(e) => patch({ recipients: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-sky-400"
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Quando enviar e-mail</label>
                <select value={draft.notifyWhen} onChange={(e) => patch({ notifyWhen: e.target.value as WatchRoutine["notifyWhen"] })} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                  <option value="always">Sempre (confirma que está OK também)</option>
                  <option value="only_failure">Só quando algo estiver fora do ar</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Timeout (ms)</label>
                  <input type="number" min={3000} max={30000} step={1000} value={draft.timeoutMs} onChange={(e) => patch({ timeoutMs: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Tentativas extras</label>
                  <input type="number" min={0} max={5} value={draft.retries} onChange={(e) => patch({ retries: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Sites monitorados</label>
              <button
                onClick={() => patch({ targets: [...draft.targets, { id: `alvo-${Date.now()}`, label: "", url: "", enabled: true }] })}
                className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
              ><Plus className="w-3.5 h-3.5" /> Adicionar site</button>
            </div>
            <div className="mt-2 space-y-2">
              {draft.targets.map((t, i) => (
                <div key={t.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={t.enabled} onChange={(e) => patchTarget(i, { enabled: e.target.checked })} className="w-4 h-4 accent-sky-500" title="Monitorar este site" />
                    <input value={t.label} onChange={(e) => patchTarget(i, { label: e.target.value })} placeholder="Nome (ex: Site institucional)" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                    <button onClick={() => patch({ targets: draft.targets.filter((_, idx) => idx !== i) })} className="p-2 text-slate-400 hover:text-red-500" title="Remover"><X className="w-4 h-4" /></button>
                  </div>
                  <input value={t.url} onChange={(e) => patchTarget(i, { url: e.target.value })} placeholder="https://archtechtour.com" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" />
                  <input value={t.mustContain || ""} onChange={(e) => patchTarget(i, { mustContain: e.target.value || undefined })} placeholder="Texto que precisa aparecer na página (opcional) — detecta site no ar mas quebrado" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: "Portal ATT", url: "https://app.archtechtour.com" },
                { label: "Customizadores", url: "https://explorar.archtechtour.com" },
              ].filter((s) => !draft.targets.some((t) => t.url.replace(/\/$/, "") === s.url)).map((s) => (
                <button key={s.url} onClick={() => patch({ targets: [...draft.targets, { id: `alvo-${Date.now()}`, label: s.label, url: s.url, enabled: true }] })} className="text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-sky-400 hover:text-sky-600">
                  + {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Remetente (precisa ser do domínio verificado archtechtour.com)</label>
            <input value={draft.sender} onChange={(e) => patch({ sender: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono" />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              {routine?.updatedAt && new Date(routine.updatedAt).getTime() > 0
                ? `Última alteração: ${new Date(routine.updatedAt).toLocaleString("pt-BR")}${routine.updatedBy ? ` por ${routine.updatedBy}` : ""}`
                : "Rotina padrão — ainda não editada."}
            </p>
            <div className="flex gap-2">
              {dirty && <button onClick={() => setDraft(routine)} className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100">Descartar</button>}
              <button onClick={save} disabled={!dirty || saving} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-30">
                {saving ? "Salvando…" : "Salvar rotina"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Histórico (90 dias)</p>
          <div className="space-y-1.5">
            {history.filter((h) => h.results).map((h) => (
              <div key={h.id} className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-0">
                <Badge className={h.overallOk ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs" : "bg-red-50 text-red-700 border-red-200 text-xs"}>{h.overallOk ? "OK" : "FALHA"}</Badge>
                <span className="text-slate-600">{new Date(h.ranAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                <span className="text-xs text-slate-400">{h.trigger === "manual" ? "manual" : "automática"}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {(h.results || []).map((r) => `${r.label}: ${r.ok ? `${r.httpStatus}` : r.error}`).join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// FASE 8 — ANALYTICS
// ============================================================
function AnalyticsPage({ user }: { user: SeedUser }) {
  const t = useT();
  const isClient = user.role === "client";
  const [tab, setTab] = useState<"dashboard" | "manage">("dashboard");

  // Admin: lista clientes do dim_client_alias (Athena) — fonte de verdade do alias
  const [dimClients, setDimClients] = useState<Array<{ alias: string; cliente: string }>>([]);
  const [selectedAlias, setSelectedAlias] = useState<string>("");

  useEffect(() => {
    if (isClient) return;
    fetch("/api/analytics/clients")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.clients || []) as Array<{ alias: string; cliente: string }>;
        setDimClients(list);
        // Default: RS Design (urgente), senão primeiro com dashboard
        const def = list.find((c) => c.alias === "rsdesign") || list[0];
        if (def) setSelectedAlias(def.alias);
      })
      .catch(() => {});
  }, [isClient]);

  // Para cliente: mapeia clientId → alias via match por nome do cliente no dim
  // (CLIENTS do portal pode não bater 1-1 com o dim — usa nome como chave)
  const clientPortalEntry = isClient ? CLIENTS.find((c) => c.id === user.clientId) : null;
  const clientAlias = isClient
    ? (dimClients.find((d) => d.cliente.toLowerCase() === (clientPortalEntry?.name || "").toLowerCase())?.alias
        || clientPortalEntry?.code.toLowerCase()
        || "")
    : selectedAlias;
  const clientName = isClient
    ? (clientPortalEntry?.name || "")
    : (dimClients.find((d) => d.alias === selectedAlias)?.cliente || "");

  // Cliente também precisa fetch do dim pra mapear seu alias
  useEffect(() => {
    if (!isClient || dimClients.length > 0) return;
    fetch("/api/analytics/clients")
      .then((r) => r.json())
      .then((d) => setDimClients(d.clients || []))
      .catch(() => {});
  }, [isClient, dimClients.length]);

  if (!isClient && tab === "manage") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setTab("dashboard")} className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition">← Voltar ao dashboard</button>
        </div>
        <AnalyticsClientsAdmin />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          eyebrow="Analytics"
          title="Dashboard de desempenho"
          description={
            isClient
              ? "Acompanhe o alcance e engajamento dos seus produtos 3D na plataforma ArchTechTour."
              : "Métricas reais do customizador 3D — dados do AWS Athena. Use 'Atualizar' para puxar dados frescos."
          }
        />
        {!isClient && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cliente</span>
              <select
                value={selectedAlias}
                onChange={(e) => setSelectedAlias(e.target.value)}
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-cyan-500/30 cursor-pointer"
                disabled={dimClients.length === 0}
              >
                {dimClients.length === 0 && <option value="">{t("portal.loading")}</option>}
                {dimClients.map((c) => (
                  <option key={c.alias} value={c.alias}>{c.cliente}</option>
                ))}
              </select>
            </div>
            {can(user, "analytics", "edit") && <button
              onClick={() => setTab("manage")}
              className="rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
              title="Listar/adicionar clientes na dim_client_alias do Athena"
            >
              Gerenciar clientes
            </button>}
          </div>
        )}
      </div>

      {clientAlias ? (
        <AnalyticsDashboard clientAlias={clientAlias} clientName={clientName} canRefresh={!isClient} />
      ) : (
        <div className="flex items-center justify-center h-32 text-sm text-slate-400">{t("portal.loading")}</div>
      )}
    </div>
  );
}

// ─── Portal header actions (extracted to use hooks) ────────────────────────
function PortalHeaderActions({
  currentUser,
  setCurrentUser,
  setPage,
  setSelectedBlock,
}: {
  currentUser: SeedUser;
  setCurrentUser: (u: SeedUser | null) => void;
  setPage: (p: string) => void;
  setSelectedBlock: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-3 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm md:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-[11px] font-semibold text-white">
          {currentUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{currentUser.name}</p>
          <p className="text-[11px] text-slate-500">{ROLE_LABELS[currentUser.role]}</p>
        </div>
      </div>
      <LanguageSwitcher theme="light" />
      <NotificationsMenu currentUser={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />
      <button
        onClick={() => {
          // keepalive: o registro chega mesmo com o redirect do signOut logo em seguida.
          logActivity({ type: "logout", entity: "session", desc: "Saiu do portal" });
          setActivityActor(null);
          clearSession();
          setCurrentUser(null);
          setPage("dashboard");
          // Encerra TAMBÉM a sessão do NextAuth. Sem isso o logout não acontecia:
          // o cookie do SSO continuava válido, o LoginPage montava, o efeito de
          // auto-login via Microsoft via a sessão e reentrava no portal na hora.
          // O redirect recarrega a página e zera o estado em memória.
          signOut({ callbackUrl: "/portal" });
        }}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:text-rose-600"
      >
        <LogOut className="h-4 w-4" />
        {t("portal.logout")}
      </button>
    </div>
  );
}

// ============================================================
// PERSISTÊNCIA POR DELTA
// ============================================================
/**
 * Manda ao servidor só o que mudou desde a última gravação confirmada
 * (`{ upsert, delete }`), com debounce de 800ms. Em falha, desfaz o retrato
 * otimista e tenta de novo em 5s. `pending[key]` guarda um envio imediato com
 * keepalive para o `pagehide` (fechar a aba não perde a gravação).
 */
function useDeltaPersist<T extends { id: string }>(opts: {
  key: string; path: string; items: T[]; hydrated: boolean;
  snapshots: React.MutableRefObject<Record<string, Map<string, string>>>;
  pending: React.MutableRefObject<Record<string, (() => void) | undefined>>;
  retryTick: number; bumpRetry: () => void;
  onActivities: (acts: SeedActivity[]) => void;
}) {
  const { key, path, items, hydrated, snapshots, pending, retryTick, bumpRetry, onActivities } = opts;
  useEffect(() => {
    if (!hydrated) return;
    const snap = snapshots.current[key];
    if (!snap) return;
    const upsert: T[] = [];
    const del: string[] = [];
    const seen = new Set<string>();
    for (const it of items) {
      seen.add(it.id);
      if (snap.get(it.id) !== JSON.stringify(it)) upsert.push(it);
    }
    snap.forEach((_, id) => { if (!seen.has(id)) del.push(id); });
    if (!upsert.length && !del.length) { pending.current[key] = undefined; return; }

    const send = async (keepalive: boolean) => {
      pending.current[key] = undefined;
      // Retrato otimista: evita reenviar o mesmo item enquanto o request está no ar.
      const previous = new Map<string, string | undefined>();
      for (const it of upsert) { previous.set(it.id, snap.get(it.id)); snap.set(it.id, JSON.stringify(it)); }
      for (const id of del) { previous.set(id, snap.get(id)); snap.delete(id); }
      try {
        const r = await fetch(path, {
          method: "POST", keepalive,
          headers: { "Content-Type": "application/json", ...actorHeaders() },
          body: JSON.stringify({ upsert, delete: del }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json().catch(() => ({}));
        if (Array.isArray(j.activities) && j.activities.length) onActivities(j.activities as SeedActivity[]);
      } catch (e) {
        console.error(`Falha ao gravar ${key}:`, e);
        previous.forEach((v, id) => { if (v === undefined) snap.delete(id); else snap.set(id, v); });
        setTimeout(bumpRetry, 5000);
      }
    };
    pending.current[key] = () => { void send(true); };
    const t = setTimeout(() => { void send(false); }, 800);
    return () => clearTimeout(t);
  }, [items, hydrated, retryTick]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ============================================================
// MAIN PORTAL
// ============================================================
export default function Portal() {
  const [currentUser, setCurrentUser] = useState<SeedUser | null>(null);
  const [page, setPage] = useState("dashboard");
  // Restaura quem estava logado e a tela aberta (ver SESSÃO NO NAVEGADOR).
  // Roda em efeito, não no useState inicial: o componente ainda passa pelo SSR.
  useEffect(() => {
    const stored = readSession();
    if (!stored) return;
    setCurrentUser({ ...stored.user, password: "" } as SeedUser);
    const savedPage = readPage();
    if (savedPage) setPage(savedPage);
  }, []);
  useEffect(() => { if (currentUser) saveSession(currentUser); }, [currentUser]);
  useEffect(() => { if (currentUser) savePage(page); }, [page, currentUser]);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState("");
  const [selectedContract, setSelectedContract] = useState("");
  // Filtro de status pré-aplicado ao abrir "Blocos" a partir de um card do dashboard.
  const [blocksPreset, setBlocksPreset] = useState<string>("all");
  const openBlocks = (status: BlockStatus | "all") => { setBlocksPreset(status); setPage("blocks"); };
  useEffect(() => { if (page !== "blocks" && blocksPreset !== "all") setBlocksPreset("all"); }, [page, blocksPreset]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Quem está logado vai em todo fetch de gravação (cabeçalho x-att-actor):
  // é assim que o servidor sabe QUEM fez cada mudança no log de atividades.
  useEffect(() => {
    setActivityActor(currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, email: currentUser.email, clientId: currentUser.clientId } : null);
  }, [currentUser]);
  // Retrato item a item de cada tabela como está no banco (id → JSON). Os
  // efeitos de persistência mandam só o DELTA (itens que mudaram + ids
  // removidos), nunca a tabela inteira: dois usuários ao mesmo tempo não se
  // sobrescrevem, exclusão realmente apaga no banco, e o servidor consegue
  // descrever cada mudança no log de atividades.
  const persisted = useRef<Record<string, Map<string, string>>>({});
  const pendingFlush = useRef<Record<string, (() => void) | undefined>>({});
  const [persistRetry, setPersistRetry] = useState(0);
  const bumpRetry = useCallback(() => setPersistRetry((n) => n + 1), []);
  const [blocks, setBlocks] = useState<SeedBlock[]>(INITIAL_BLOCKS);
  const [activities, setActivities] = useState<SeedActivity[]>(ACTIVITIES);
  // Arquivos dos blocos: começa vazio e carrega de att-assets (nunca o seed fictício).
  const [assets, setAssets] = useState<SeedAsset[]>([]);
  const [tickets, setTickets] = useState<ProductionTicket[]>(TICKETS);
  const [clients, setClients] = useState<SeedClient[]>(CLIENTS);
  const [contracts, setContracts] = useState<SeedContract[]>(CONTRACTS);
  const [publications, setPublications] = useState<SeedPub[]>(PUBLICATIONS);
  const [users, setUsers] = useState<SeedUser[]>(USERS);
  const [bimDemands, setBimDemands] = useState<BimDemand[]>([]);
  const [finishes, setFinishes] = useState<FinishRecord[]>([]);
  const [kb, setKb] = useState<KbRecord[]>([]);
  const [kbError, setKbError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<AccessProfile[]>(DEFAULT_PROFILES);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  PROFILES = profiles; // can()/special()/podeAcessar leem daqui — atribuído antes de desenhar os filhos
  const [hydrated, setHydrated] = useState(false);

  // Load mutable state from DynamoDB on mount. Seed tables on first use.
  //
  // ⚠️ Regra de segurança: só semeia uma tabela quando o GET respondeu OK com
  // lista VAZIA. Antes, qualquer erro de rede/IAM (resposta {error} sem items)
  // caía no "else" e fazia POST do seed — que é replaceAll — por cima da tabela
  // de produção. Com erro, não escrevemos nada e avisamos na tela.
  useEffect(() => {
    const load = async (path: string): Promise<unknown[]> => {
      const r = await fetch(path);
      if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
      const j = await r.json();
      if (!Array.isArray(j.items)) throw new Error(`${path} → resposta sem lista`);
      return j.items;
    };
    const seedIfEmpty = async (path: string, items: unknown[], seed: unknown[]) => {
      if (items.length === 0) await fetch(path, { method: "POST", body: JSON.stringify(seed) });
    };
    (async () => {
      try {
        const [b, t, a, c, ctr, pub, u, bd, fin] = await Promise.all([
          load("/api/state/blocks"), load("/api/state/tickets"), load("/api/state/activities?days=90"),
          load("/api/state/clients"), load("/api/state/contracts"), load("/api/state/publications"),
          load("/api/state/users"), load("/api/state/bim-demands"), load("/api/state/finishes"),
        ]);

        const snap = (items: unknown[]) => new Map((items as { id: string }[]).map((i) => [i.id, JSON.stringify(i)]));
        // Mescla (não substitui): a carga dos arquivos (att-assets) roda em paralelo
        // e costuma terminar antes — substituir o objeto apagava o retrato dela e o
        // persist de arquivos nunca rodava (upload "sumia" ao trocar de página).
        persisted.current = {
          ...persisted.current,
          blocks: snap(b.length ? b : INITIAL_BLOCKS), tickets: snap(t.length ? t : TICKETS),
          clients: snap(c.length ? c : CLIENTS), contracts: snap(ctr.length ? ctr : CONTRACTS),
          publications: snap(pub.length ? pub : PUBLICATIONS), users: snap(u.length ? u : USERS),
          bimDemands: snap(bd), finishes: snap(fin),
        };
        if (b.length) setBlocks(b as SeedBlock[]); else await seedIfEmpty("/api/state/blocks", b, INITIAL_BLOCKS);
        if (t.length) { setTickets(t as ProductionTicket[]); TICKETS = t as ProductionTicket[]; } else await seedIfEmpty("/api/state/tickets", t, TICKETS);
        setActivities(a as SeedActivity[]); // só leitura: o log é escrito pelo servidor
        if (c.length) { setClients(c as SeedClient[]); CLIENTS = c as SeedClient[]; } else await seedIfEmpty("/api/state/clients", c, CLIENTS);
        if (ctr.length) { setContracts(ctr as SeedContract[]); CONTRACTS = ctr as SeedContract[]; } else await seedIfEmpty("/api/state/contracts", ctr, CONTRACTS);
        if (pub.length) setPublications(pub as SeedPub[]); else await seedIfEmpty("/api/state/publications", pub, PUBLICATIONS);
        if (u.length) { setUsers(u as SeedUser[]); USERS.length = 0; USERS.push(...(u as SeedUser[])); } else await seedIfEmpty("/api/state/users", u, USERS);
        setBimDemands(bd as BimDemand[]); // sem seed: começa vazio mesmo
        setFinishes(fin as FinishRecord[]);

        setHydrated(true);
      } catch (e) {
        console.error("Failed to load state:", e);
        // hydrated fica false de propósito: os efeitos de persistência não rodam,
        // então nada do que o usuário fizer sobrescreve o banco com dado de seed.
        setLoadError((e as Error).message);
      }
    })();
  }, []);

  // Arquivos dos blocos (att-assets): carga separada e tolerante — se falhar, a
  // aba "Arquivos" fica vazia e nada é gravado (sem retrato, o persist não roda).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/state/assets");
        if (!r.ok) throw new Error(`/api/state/assets → HTTP ${r.status}`);
        const j = await r.json();
        if (!Array.isArray(j.items)) throw new Error(j.error || "/api/state/assets → resposta sem lista");
        persisted.current.assets = new Map((j.items as SeedAsset[]).map((i) => [i.id, JSON.stringify(i)]));
        setAssets(j.items as SeedAsset[]);
      } catch (e) {
        console.error("Failed to load assets:", e);
      }
    })();
  }, []);

  // Perfis de acesso (att-profiles): carga separada e tolerante. Se falhar, valem
  // os perfis padrão do código (o comportamento de antes dos perfis) e, sem
  // retrato, o persist não roda — nada é gravado por cima.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/state/profiles");
        if (!r.ok) throw new Error(`/api/state/profiles → HTTP ${r.status}`);
        const j = await r.json();
        if (!Array.isArray(j.items)) throw new Error(j.error || "/api/state/profiles → resposta sem lista");
        const merged = mergeProfiles(j.items as AccessProfile[]);
        // O retrato inclui os padrões do código: só o que o admin MUDAR vai para o banco.
        persisted.current.profiles = new Map(merged.map((i) => [i.id, JSON.stringify(i)]));
        setProfiles(merged);
      } catch (e) {
        console.error("Failed to load profiles:", e);
        setProfilesError((e as Error).message);
      }
    })();
  }, []);

  // Base de Conhecimento: carga separada e tolerante a falha — se a tabela
  // att-kb não existir ou faltar permissão IAM, só a KB fica indisponível
  // (com aviso na tela), sem derrubar a hidratação das outras tabelas.
  // Seed só quando o GET respondeu OK com lista vazia (mesma regra das outras).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/state/kb");
        if (!r.ok) throw new Error(`/api/state/kb → HTTP ${r.status}`);
        const j = await r.json();
        if (!Array.isArray(j.items)) throw new Error(j.error || "/api/state/kb → resposta sem lista");
        if (j.items.length === 0) {
          const s = await fetch("/api/state/kb", { method: "POST", body: JSON.stringify(KB_SEED) });
          if (!s.ok) throw new Error(`seed da KB → HTTP ${s.status}`);
          setKb(KB_SEED);
        } else {
          setKb(j.items as KbRecord[]);
        }
      } catch (e) {
        console.error("Failed to load KB:", e);
        setKbError((e as Error).message);
      }
    })();
  }, []);

  // Espelhos globais usados por helpers fora do React (getUserName, getClientName…)
  useEffect(() => { if (hydrated) TICKETS = tickets; }, [tickets, hydrated]);
  useEffect(() => { if (hydrated) CLIENTS = clients; }, [clients, hydrated]);
  useEffect(() => { if (hydrated) CONTRACTS = contracts; }, [contracts, hydrated]);
  useEffect(() => { if (hydrated) { USERS.length = 0; USERS.push(...users); } }, [users, hydrated]);
  // Sessão restaurada do navegador é revalidada contra o cadastro assim que ele
  // chega do banco: pega perfil/telas atualizados e derruba quem foi desativado.
  // Usuário Microsoft sem cadastro (id ms_…) não está na tabela — fica como está.
  useEffect(() => {
    if (!hydrated || !currentUser || currentUser.id.startsWith("ms_")) return;
    const fresh = users.find((u) => u.id === currentUser.id);
    if (!fresh) return;
    if (fresh.active === false) { clearSession(); setCurrentUser(null); return; }
    if (JSON.stringify({ ...fresh, password: "" }) !== JSON.stringify({ ...currentUser, password: "" })) setCurrentUser(fresh);
  }, [hydrated, users]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persistência DynamoDB por DELTA, debounce 800ms. O servidor devolve as
  // atividades que descreveu para cada mudança; elas entram no log local na hora.
  const appendActivities = useCallback((acts: SeedActivity[]) => setActivities((prev) => {
    const ids = new Set(prev.map((a) => a.id));
    return [...prev, ...acts.filter((a) => !ids.has(a.id))];
  }), []);
  const persistOpts = { hydrated, snapshots: persisted, pending: pendingFlush, retryTick: persistRetry, bumpRetry, onActivities: appendActivities };
  useDeltaPersist({ ...persistOpts, key: "blocks", path: "/api/state/blocks", items: blocks });
  useDeltaPersist({ ...persistOpts, key: "tickets", path: "/api/state/tickets", items: tickets });
  useDeltaPersist({ ...persistOpts, key: "clients", path: "/api/state/clients", items: clients });
  useDeltaPersist({ ...persistOpts, key: "contracts", path: "/api/state/contracts", items: contracts });
  useDeltaPersist({ ...persistOpts, key: "publications", path: "/api/state/publications", items: publications });
  useDeltaPersist({ ...persistOpts, key: "bimDemands", path: "/api/state/bim-demands", items: bimDemands });
  useDeltaPersist({ ...persistOpts, key: "finishes", path: "/api/state/finishes", items: finishes });
  useDeltaPersist({ ...persistOpts, key: "users", path: "/api/state/users", items: users });
  useDeltaPersist({ ...persistOpts, key: "assets", path: "/api/state/assets", items: assets });
  useDeltaPersist({ ...persistOpts, key: "profiles", path: "/api/state/profiles", items: profiles });
  // Fechou a aba dentro dos 800ms? Manda o que estiver pendente com keepalive.
  useEffect(() => {
    const flush = () => Object.values(pendingFlush.current).forEach((fn) => fn?.());
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  // Ao logar, cai na primeira página permitida. Sem isso um cliente restrito a
  // Analytics entraria direto na tela bloqueada, já que o padrão é "dashboard".
  useEffect(() => {
    if (!currentUser) return;
    setPage((atual) => (podeAcessar(currentUser, atual) ? atual : primeiraPaginaPermitida(currentUser)));
  }, [currentUser, profiles]);

  // Toda tela aberta vira "page_view" no log — é a medida de uso do portal.
  useEffect(() => {
    if (!currentUser) return;
    const label = PAGE_LABELS[page] ?? page;
    const b = page === "block_detail" ? blocks.find((x) => x.id === selectedBlock) : undefined;
    logActivity({ type: "page_view", entity: "session", page, clientId: currentUser.clientId, desc: `Abriu a tela ${label}${b ? ` · ${b.title} (${b.sku})` : ""}` });
  }, [page, selectedBlock, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date()),
    [],
  );

  if (!currentUser) {
    return (
      <AppContext.Provider value={{ currentUser, setCurrentUser, hydrated, blocks, setBlocks, activities, setActivities, assets, setAssets, tickets, setTickets, clients, setClients, contracts, setContracts, publications, setPublications, bimDemands, setBimDemands, finishes, setFinishes, users, setUsers, kb, setKb, kbError, profiles, setProfiles }}>
        <LoginPage />
      </AppContext.Provider>
    );
  }

  const isClient = currentUser.role === "client";
  const isFreelancer = currentUser.role === "freelancer_bim";
  const shellLabel = isFreelancer ? "Área do terceirizado" : isClient ? "Portal do cliente" : "Operações internas";
  const workspaceTitle = isFreelancer ? "Blocos BIM · ArchTechTour" : isClient ? getClientName(currentUser.clientId!) : "Pipeline ArchTechTour";

  const renderPage = () => {
    // Trava de acesso — vale para QUALQUER caminho até a página, inclusive os
    // botões dentro do dashboard do cliente que chamam setPage() direto.
    if (!podeAcessar(currentUser, page)) {
      return (
        <EmptyState
          icon={Lock}
          title="Área ainda não liberada"
          desc="Esta seção do portal está em validação e ainda não foi liberada para o seu acesso. Fale com a equipe ArchTechTour se precisar dela."
        />
      );
    }
    switch (page) {
      case "dashboard": return isClient ? <ClientDashboard user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} /> : <InternalDashboard setPage={setPage} openBlocks={openBlocks} setSelectedBlock={setSelectedBlock} setSelectedContract={setSelectedContract} />;
      case "onboarding": return <OnboardingWizardPage user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "blocks": return <BlocksListPage key={blocksPreset} user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} initialStatus={blocksPreset} />;
      case "block_detail": return <BlockDetailPage blockId={selectedBlock} user={currentUser} setPage={setPage} />;
      case "contracts": return <ContractsPage user={currentUser} setPage={setPage} setSelectedContract={setSelectedContract} />;
      case "contract_detail": return <ContractDetailPage contractId={selectedContract} user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "clients": return <ClientsPage />;
      case "approvals": return <ApprovalsPage user={currentUser} />;
      case "queue": return <QueuePage user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "tickets": return <ProductionTicketsPage user={currentUser} />;
      case "publications": return <PublicationsPage user={currentUser} />;
      case "analytics": return <AnalyticsPage user={currentUser} />;
      case "activity": return <ActivityPage setPage={setPage} setSelectedBlock={setSelectedBlock} setSelectedContract={setSelectedContract} />;
      case "users": return <UsersPage />;
      case "profiles": return <AccessProfilesPage profiles={profiles} setProfiles={setProfiles} users={users} actorName={currentUser.name} loadError={profilesError}
        perms={{ create: can(currentUser, "profiles", "create"), edit: can(currentUser, "profiles", "edit"), delete: can(currentUser, "profiles", "delete") }} />;
      case "finishes": return <FinishesPage user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "bim": return <BimPage user={currentUser} />;
      case "bim_minhas": return <BimMinhasDemandasPage user={currentUser} />;
      case "kb": return <KnowledgeBase user={currentUser} users={users} records={kb} setRecords={setKb} loadError={kbError} />;
      case "agents": return <AgentsPage setPage={setPage} />;
      case "agent_sherlock_codes": return <SherlockCodesPage setPage={setPage} />;
      case "agent_monk_lighthouse": return <MonkLighthousePage setPage={setPage} />;
      case "agent_yoda_kanban": return <YodaKanbanPage setPage={setPage} />;
      case "agent_harvey_closer": return <HarveyCloserPage setPage={setPage} />;
      case "agent_argus_watchtower": return <ArgusWatchtowerPage setPage={setPage} />;
      default: return <InternalDashboard setPage={setPage} openBlocks={openBlocks} setSelectedBlock={setSelectedBlock} setSelectedContract={setSelectedContract} />;
    }
  };

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, hydrated, blocks, setBlocks, activities, setActivities, assets, setAssets, tickets, setTickets, clients, setClients, contracts, setContracts, publications, setPublications, bimDemands, setBimDemands, finishes, setFinishes, users, setUsers, kb, setKb, kbError, profiles, setProfiles }}>
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.08),transparent_26%),radial-gradient(circle_at_100%_0%,_rgba(16,185,129,0.06),transparent_22%),linear-gradient(180deg,#f8fbff_0%,#f3f7fb_100%)]">
        <div className="pointer-events-none fixed inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(15,23,42,0.36)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.36)_1px,transparent_1px)] [background-size:72px_72px]" />
        <Sidebar page={page} setPage={setPage} user={currentUser} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className={`relative transition-all duration-300 ${collapsed ? "ml-[88px]" : "ml-[280px]"}`}>
          <header className="sticky top-0 z-30 border-b border-white/70 bg-white/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 lg:px-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{shellLabel}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-900">{workspaceTitle}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-slate-500">{todayLabel}</span>
                </div>
              </div>
              <PortalHeaderActions currentUser={currentUser} setCurrentUser={setCurrentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />
            </div>
          </header>
          {loadError && (
            <div className="mx-auto w-full max-w-[1400px] px-6 pt-4 lg:px-8">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1"><b>Não foi possível carregar os dados do banco</b> — os números na tela são de exemplo e <b>nada que você alterar será salvo</b>. Recarregue a página; se persistir, avise a equipe. Detalhe: {loadError}</span>
                <button onClick={() => window.location.reload()} className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Recarregar</button>
              </div>
            </div>
          )}
          <main className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-8">{renderPage()}</main>
        </div>
      </div>
    </AppContext.Provider>
  );
}

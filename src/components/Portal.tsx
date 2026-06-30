"use client";
import React, { useState, useMemo, useEffect, createContext, useContext, useCallback, ReactNode, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useT } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import { MIGRATED_BLOCKS, MIGRATED_CONTRACTS, MIGRATED_PUBLICATIONS, MIGRATED_TICKETS } from "@/data/seed";
import {
  LayoutDashboard, Package, FileText, Users, CheckCircle, Activity,
  Globe, Search, Bell, LogOut, Menu, X, Plus, Upload, Clock,
  AlertTriangle, Eye, ChevronDown, ArrowLeft, Copy, Check, Layers,
  Settings, UserCheck, Clipboard, Box, FileUp, ExternalLink, Zap,
  Play, ThumbsUp, ThumbsDown, Hash, Pause, Lock, Archive,
  BarChart3, ChevronRight, Filter, MessageSquare, Sparkles, Send, Bot, RefreshCw
} from "lucide-react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import AnalyticsClientsAdmin from "./AnalyticsClientsAdmin";

// ============================================================
// TYPES & CONSTANTS
// ============================================================
type UserRole = "admin" | "internal_ops" | "internal_modeling" | "internal_programming" | "client";
type ServiceType = "standard" | "plus" | "ultra";
type Priority = "low" | "normal" | "high" | "urgent";
type ApprovalStatusType = "pending" | "approved" | "rejected";
type BlockStatus =
  | "draft" | "awaiting_client_files" | "client_files_under_review"
  | "ready_to_start" | "in_modeling" | "awaiting_client_material_validation"
  | "approved_for_programming" | "in_programming" | "internal_review"
  | "awaiting_client_final_validation" | "approved" | "published"
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
}

interface SeedUser {
  id: string; email: string; password: string; name: string; role: UserRole;
  clientId?: string; active: boolean;
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
}
interface SeedAsset {
  id: string; blockId: string; cat: AssetCategory;
  name: string; size: number; v: number; by: string;
  analysis?: { score: number; approved: boolean; summary: string; issues: string[]; suggestions: string[]; notes?: string[]; };
  uploadedAt?: string;
}
interface SeedApproval {
  id: string; blockId: string; type: string;
  status: ApprovalStatusType; comment?: string;
  by: string; decided?: string; at: string;
}
interface SeedActivity {
  id: string; blockId: string; userId: string;
  type: string; desc: string; at: string;
}
export interface SeedPub {
  id: string; blockId: string; url: string;
  embed: string; env: string; v: number;
}

const STATUS_LABELS: Record<BlockStatus, string> = {
  draft: "Rascunho", awaiting_client_files: "Aguardando Arquivos",
  client_files_under_review: "Arquivos em Revisão", ready_to_start: "Pronto p/ Iniciar",
  in_modeling: "Em Modelagem", awaiting_client_material_validation: "Validação Material",
  approved_for_programming: "Aprovado p/ Programação", in_programming: "Em Programação",
  internal_review: "Revisão Interna", awaiting_client_final_validation: "Validação Final",
  approved: "Aprovado", published: "Publicado", blocked: "Bloqueado",
  on_hold: "Em Espera", archived: "Arquivado",
};

const STATUS_COLORS: Record<BlockStatus, string> = {
  draft: "border-slate-200/80 bg-slate-100/90 text-slate-600",
  awaiting_client_files: "border-amber-200/80 bg-amber-50 text-amber-700",
  client_files_under_review: "border-sky-200/80 bg-sky-50 text-sky-700",
  ready_to_start: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  in_modeling: "border-violet-200/80 bg-violet-50 text-violet-700",
  awaiting_client_material_validation: "border-orange-200/80 bg-orange-50 text-orange-700",
  approved_for_programming: "border-cyan-200/80 bg-cyan-50 text-cyan-700",
  in_programming: "border-indigo-200/80 bg-indigo-50 text-indigo-700",
  internal_review: "border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-700",
  awaiting_client_final_validation: "border-amber-200/80 bg-amber-50 text-amber-700",
  approved: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
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
const ROLE_LABELS: Record<UserRole, string> = { admin: "Admin", internal_ops: "Operações", internal_modeling: "Modelagem", internal_programming: "Programação", client: "Cliente" };
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
const VALID_TRANSITIONS: Record<BlockStatus, BlockStatus[]> = {
  draft: ["awaiting_client_files", "blocked", "on_hold", "archived"],
  awaiting_client_files: ["client_files_under_review", "blocked", "on_hold", "archived"],
  client_files_under_review: ["ready_to_start", "awaiting_client_files", "blocked", "on_hold"],
  ready_to_start: ["in_modeling", "blocked", "on_hold"],
  in_modeling: ["awaiting_client_material_validation", "blocked", "on_hold"],
  awaiting_client_material_validation: ["approved_for_programming", "in_modeling", "blocked", "on_hold"],
  approved_for_programming: ["in_programming", "blocked", "on_hold"],
  in_programming: ["internal_review", "blocked", "on_hold"],
  internal_review: ["awaiting_client_final_validation", "in_programming", "blocked", "on_hold"],
  awaiting_client_final_validation: ["approved", "internal_review", "blocked", "on_hold"],
  approved: ["published"],
  published: ["archived"],
  blocked: ["draft", "awaiting_client_files", "ready_to_start", "in_modeling", "in_programming", "archived"],
  on_hold: ["draft", "awaiting_client_files", "ready_to_start", "in_modeling", "in_programming", "archived"],
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
  { id: "u6", email: "info@archtechtour.com", password: "arch@2025", name: "Jéssica Ribeiro", role: "internal_ops", active: true },
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

const APPROVALS: SeedApproval[] = [
  { id: "ap1", blockId: "pb1", type: "material_validation", status: "approved", comment: "Materiais e acabamentos ok.", by: "u3", decided: "u8", at: "2025-05-20" },
  { id: "ap2", blockId: "pb1", type: "final_validation", status: "approved", comment: "Aprovado pela marca. Publicar.", by: "u5", decided: "u8", at: "2025-07-15" },
  { id: "ap3", blockId: "pb4", type: "material_validation", status: "pending", by: "u3", at: "2025-09-01" },
  { id: "ap4", blockId: "pb7", type: "final_validation", status: "pending", comment: "Aguardando revisão da Acácia.", by: "u3", at: "2026-03-20" },
  { id: "ap5", blockId: "pb14", type: "final_validation", status: "approved", comment: "Jantar Triz aprovado.", by: "u3", decided: "u9", at: "2025-12-15" },
];

const ACTIVITIES: SeedActivity[] = [
  { id: "al1", blockId: "pb1", userId: "u1", type: "block_created", desc: "Bloco criado: Banco Nub", at: "2025-03-15T10:00" },
  { id: "al2", blockId: "pb1", userId: "u8", type: "asset_uploaded", desc: "CAD enviado: banco_nub_v3.step", at: "2025-03-20T14:00" },
  { id: "al3", blockId: "pb1", userId: "u3", type: "status_changed", desc: "Status: Em Modelagem → Concluído", at: "2025-05-15T10:00" },
  { id: "al4", blockId: "pb1", userId: "u8", type: "approval_approved", desc: "Material aprovado pela Escal", at: "2025-05-20T16:00" },
  { id: "al5", blockId: "pb1", userId: "u5", type: "publication_updated", desc: "Publicação v11 configurada", at: "2025-07-23T14:10" },
  { id: "al6", blockId: "pb7", userId: "u2", type: "block_created", desc: "Bloco criado: Poltrona Acácia", at: "2024-08-01T10:00" },
  { id: "al7", blockId: "pb7", userId: "u9", type: "asset_uploaded", desc: "CAD v4 enviado: poltrona_acacia_v4.step", at: "2025-06-10T10:00" },
  { id: "al8", blockId: "pb22", userId: "u1", type: "status_changed", desc: "Bloqueado: Informações insuficientes do cliente", at: "2025-10-05T10:00" },
  { id: "al9", blockId: "pb2", userId: "u5", type: "status_changed", desc: "Status: Modelagem → Em Programação", at: "2025-08-20T10:00" },
  { id: "al10", blockId: "pb13", userId: "u6", type: "status_changed", desc: "Status: Pronto para iniciar (urgente)", at: "2025-11-15T10:00" },
  { id: "al11", blockId: "pb11", userId: "u5", type: "status_changed", desc: "Cadeira Cota em programação", at: "2025-10-01T10:00" },
  { id: "al12", blockId: "pb20", userId: "u2", type: "block_created", desc: "Bloco criado: Produto Validação Dexco", at: "2026-03-02T17:00" },
];

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
const fmtDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
const getUserName = (id: string) => USERS.find((u) => u.id === id)?.name || "—";
const getClientName = (id: string) => CLIENTS.find((c) => c.id === id)?.name || "—";
const getClientCode = (id: string) => CLIENTS.find((c) => c.id === id)?.code || "—";

function checkReadiness(blockId: string, serviceType: ServiceType) {
  const required = READINESS_RULES[serviceType] || [];
  const blockAssets = ASSETS.filter((a) => a.blockId === blockId);
  const cats = new Set(blockAssets.map((a) => a.cat));
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
  setPublications: React.Dispatch<React.SetStateAction<SeedPub[]>>;
  users: SeedUser[];
  setUsers: React.Dispatch<React.SetStateAction<SeedUser[]>>;
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

  // Auto-login when Microsoft SSO session arrives
  useEffect(() => {
    if (!session?.user?.email) return;
    const msEmail = (session.user.email as string).toLowerCase();
    // Match against seed users by email
    const user = USERS.find((u) => u.email.toLowerCase() === msEmail);
    if (user) {
      setCurrentUser(user);
    } else {
      // Auto-create a temporary session for any @archtechtour.com Microsoft user
      if (msEmail.endsWith("@archtechtour.com")) {
        setCurrentUser({
          id: `ms_${Date.now()}`,
          email: msEmail,
          password: "",
          name: (session.user.name as string | null | undefined) ?? msEmail,
          role: "admin",
          active: true,
        });
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
  const pendingApprovals = APPROVALS.filter((a) => {
    if (a.status !== "pending") return false;
    if (!isClient) return true;
    const relatedBlock = blocks.find((b) => b.id === a.blockId);
    return relatedBlock?.clientId === user.clientId;
  }).length;

  const navItems = isClient
    ? [
        { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { id: "onboarding", icon: Clipboard, label: "Onboarding" },
        { id: "blocks", icon: Package, label: "Meus Blocos" },
        { id: "approvals", icon: CheckCircle, label: "Aprovações", badge: pendingApprovals },
        { id: "publications", icon: Globe, label: "Publicações" },
        { id: "analytics", icon: BarChart3, label: "Analytics" },
        { id: "contracts", icon: FileText, label: "Contratos" },
      ]
    : [
        { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { id: "tickets", icon: Hash, label: "Tickets" },
        { id: "queue", icon: Layers, label: "Fila de Trabalho" },
        { id: "blocks", icon: Package, label: "Todos os Blocos" },
        { id: "approvals", icon: CheckCircle, label: "Aprovações", badge: pendingApprovals },
        { id: "publications", icon: Globe, label: "Publicações" },
        { id: "analytics", icon: BarChart3, label: "Analytics" },
        { id: "clients", icon: Users, label: "Clientes" },
        { id: "contracts", icon: FileText, label: "Contratos" },
        { id: "activity", icon: Activity, label: "Atividade" },
        { id: "users", icon: Settings, label: "Usuários" },
        ...(user.role === "admin" ? [{ id: "agents", icon: Sparkles, label: "Agentes AI" }] : []),
      ];

  const workspaceLabel = isClient ? getClientName(user.clientId!) : "Operação Interna";

  return (
    <aside className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-slate-800/60 backdrop-blur-xl transition-all duration-300 ${collapsed ? "w-[88px]" : "w-[280px]"}`} style={{ backgroundColor: "rgba(7,17,31,0.97)", color: "white" }}>
      <div className="p-4 pb-3">
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

      <nav className="flex-1 space-y-1 px-3 py-2">
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

      <div className="p-4 pt-3">
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
function InternalDashboard({ setPage }: { setPage: (p: string) => void }) {
  const { blocks } = useContext(AppContext);
  const byStatus: Record<string, number> = {};
  blocks.forEach((b) => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });
  const pending = APPROVALS.filter((a) => a.status === "pending").length;
  const recent = [...ACTIVITIES].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const activeClients = CLIENTS.map((client) => ({
    ...client,
    count: blocks.filter((b) => b.clientId === client.id).length,
  })).filter((client) => client.count > 0).sort((a, b) => b.count - a.count);

  const pipeline = [
    { s: "awaiting_client_files" as BlockStatus, icon: Clock, color: "text-amber-500" },
    { s: "ready_to_start" as BlockStatus, icon: Play, color: "text-emerald-500" },
    { s: "in_modeling" as BlockStatus, icon: Layers, color: "text-violet-500" },
    { s: "in_programming" as BlockStatus, icon: Zap, color: "text-indigo-500" },
    { s: "internal_review" as BlockStatus, icon: Eye, color: "text-fuchsia-500" },
    { s: "awaiting_client_final_validation" as BlockStatus, icon: UserCheck, color: "text-amber-500" },
    { s: "approved" as BlockStatus, icon: ThumbsUp, color: "text-emerald-600" },
    { s: "published" as BlockStatus, icon: Globe, color: "text-emerald-600" },
  ];

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
              <Badge className="border-cyan-400/15 bg-cyan-400/10 text-cyan-100">Produção + validação + publicação</Badge>
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-[2.25rem]">Toda a operação em uma interface mais editorial e menos genérica.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              O foco aqui é dar leitura rápida para bloqueios, aprovações, produção e publicações, sem cair na estética padrão de dashboard pronto.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total de blocos", value: blocks.length, sub: "Base monitorada" },
                { label: "Bloqueados", value: byStatus["blocked"] || 0, sub: "Pedem atenção" },
                { label: "Aprovações", value: pending, sub: "Pendentes" },
                { label: "Publicados", value: byStatus["published"] || 0, sub: "Ao vivo" },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] border border-white/10 bg-white/6 p-4 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.sub}</p>
                </div>
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
            onClick={() => setPage("queue")}
          />
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Pipeline</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Produção em andamento</h3>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-500">Os estágios principais aparecem como uma esteira visual para priorização rápida do time.</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pipeline.map(({ s, icon: Icon, color }) => (
            <button key={s} onClick={() => setPage("blocks")} className="group rounded-[24px] border border-slate-200/80 bg-white/75 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50">
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
                <span>Ver detalhes</span>
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
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
              const pct = Math.round((client.count / blocks.length) * 100);
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
            {recent.map((act) => {
              const block = blocks.find((b) => b.id === act.blockId);
              return (
                <div key={act.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 p-4">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Activity className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{act.desc}</p>
                      <p className="mt-1 text-sm text-slate-500">{getUserName(act.userId)}</p>
                      <p className="mt-2 text-xs text-slate-400">{block?.sku ? `${block.sku} · ` : ""}{fmtDate(act.at)}</p>
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
  const { blocks } = useContext(AppContext);
  const cid = user.clientId!;
  const ctrs = CONTRACTS.filter((c) => c.clientId === cid);
  const contracted = ctrs.reduce((s, c) => s + c.totalBlocks, 0);
  const used = ctrs.reduce((s, c) => s + c.usedBlocks, 0);
  const myBlocks = blocks.filter((b) => b.clientId === cid);
  const awaiting = myBlocks.filter((b) => ["awaiting_client_files", "awaiting_client_material_validation", "awaiting_client_final_validation"].includes(b.status)).length;
  const inProduction = myBlocks.filter((b) => ["ready_to_start", "in_modeling", "approved_for_programming", "in_programming", "internal_review"].includes(b.status)).length;
  const publishedCount = myBlocks.filter((b) => b.status === "published").length;
  const contractUsage = contracted ? Math.round((used / contracted) * 100) : 0;
  const latestContract = [...ctrs].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const nextActions = myBlocks.filter((b) => ["awaiting_client_files", "awaiting_client_material_validation", "awaiting_client_final_validation"].includes(b.status)).slice(0, 3);
  const liveBlocks = myBlocks.filter((b) => b.status === "published").slice(0, 3);
  const isNewClient = myBlocks.length === 0;

  // Onboarding steps — step 0 is always done (contract signed)
  const onboardingSteps = [
    { label: "Contrato assinado", done: true, desc: "Seu contrato está ativo e registrado." },
    { label: "Reunião de onboarding agendada", done: !isNewClient || false, desc: "A equipe ATT entrará em contato em até 5 dias úteis para agendar." },
    { label: "Envio dos arquivos", done: myBlocks.some((b) => !["awaiting_client_files"].includes(b.status)), desc: "Envie blocos 3D, fotos, logo e desenhos técnicos para info@archtechtour.com." },
    { label: "Aprovação do produto-modelo", done: myBlocks.some((b) => ["approved_for_programming", "in_programming", "internal_review", "awaiting_client_final_validation", "approved", "published"].includes(b.status)), desc: "Validaremos 10% dos produtos como amostra antes de produzir o restante." },
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
              <Badge className="border-white/10 bg-white/8 text-slate-100">Plano {latestContract?.title?.split("–")[0]?.trim() || "Ativo"}</Badge>
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
                const publication = PUBLICATIONS.find((pub) => pub.blockId === block.id);
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
function BlocksListPage({ user, setPage, setSelectedBlock }: { user: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void }) {
  const { blocks, setBlocks, activities, setActivities, tickets, setTickets } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const isClient = user.role === "client";

  const filtered = useMemo(() => {
    let list = isClient ? blocks.filter((b) => b.clientId === user.clientId) : blocks;
    if (search) list = list.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()) || b.sku.toLowerCase().includes(search.toLowerCase()) || b.csku.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== "all") list = list.filter((b) => b.status === filterStatus);
    if (filterClient !== "all") list = list.filter((b) => b.clientId === filterClient);
    return list;
  }, [blocks, search, filterStatus, filterClient, isClient, user.clientId]);

  const exportCSV = () => {
    const headers = ["SKU Interno", "SKU Cliente", "Título", "Cliente", "Tipo Serviço", "Status", "Prioridade", "Responsável", "Criado em"];
    const rows = filtered.map((b) => [
      b.sku, b.csku, b.title, getClientName(b.clientId),
      SERVICE_LABELS[b.svc], STATUS_LABELS[b.status], PRIORITY_LABELS[b.pri],
      b.owner ? getUserName(b.owner) : "", fmtDate(b.created),
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
    setBlocks([...blocks, newBlock]);
    const newAct: SeedActivity = {
      id: `al_${Date.now()}`, blockId: newBlock.id, userId: user.id,
      type: "block_created", desc: `Bloco criado: ${data.title}`,
      at: new Date().toISOString(),
    };
    setActivities([...activities, newAct]);

    // Auto-cria ticket inicial na fila — Jessica (admin) atribui responsável depois
    const slaDate = new Date();
    slaDate.setDate(slaDate.getDate() + 14); // SLA padrão: 14 dias
    const newTicket: ProductionTicket = {
      id: `tk_${Date.now()}`,
      clientId: data.clientId,
      blockId: newBlock.id,
      title: `${data.title} – Modelagem`,
      plan: data.serviceType,
      slaDate: slaDate.toISOString().slice(0, 10),
      priority: data.priority,
      status: "new",
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
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Novo Bloco
          </button>
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
        </div>
      </Card>
      <Card>
        <DataTable data={filtered} onRowClick={(row) => { setSelectedBlock(row.id); setPage("block_detail"); }} columns={[
          { label: "SKU", render: (r: SeedBlock) => <span className="font-mono text-xs text-slate-500">{r.sku}</span> },
          { label: "Título", render: (r: SeedBlock) => <div><p className="font-medium text-slate-800">{r.title}</p><p className="text-xs text-slate-400">{r.csku}</p></div> },
          ...(!isClient ? [{ label: "Cliente", render: (r: SeedBlock) => <span className="text-xs">{getClientCode(r.clientId)}</span> }] : []),
          { label: "Tipo", render: (r: SeedBlock) => <ServiceBadge type={r.svc} /> },
          { label: "Status", render: (r: SeedBlock) => <StatusBadge status={r.status} /> },
          { label: "Prioridade", render: (r: SeedBlock) => <PriorityDot priority={r.pri} /> },
          ...(!isClient ? [{ label: "Responsável", render: (r: SeedBlock) => <span className="text-xs text-slate-500">{r.owner ? getUserName(r.owner) : "—"}</span> }] : []),
        ]} />
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
        const { uploadUrl, readUrl } = await uploadResp.json();
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
  const { assets, setAssets, activities, setActivities } = useContext(AppContext);
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
  const hasCapacity = selectedContract ? selectedContract.usedBlocks < selectedContract.totalBlocks : false;
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
          const act: SeedActivity = {
            id: `al_${Date.now()}`, blockId: uploadBlockId, userId: user.id,
            type: "asset_uploaded", desc: `Arquivo enviado: ${asset.name} (${CATEGORY_LABELS[asset.cat]})`,
            at: new Date().toISOString(),
          };
          setActivities([...activities, act]);
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
              {availableContracts.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.totalBlocks - c.usedBlocks} disponíveis)</option>)}
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
function BlockEditModal({ initial, onClose, onSave }: {
  initial: SeedBlock; onClose: () => void;
  onSave: (d: { title: string; sku: string; csku: string }) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [sku, setSku] = useState(initial.sku);
  const [csku, setCsku] = useState(initial.csku);
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
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onSave({ title: title.trim(), sku: sku.trim(), csku: csku.trim() })} disabled={!canSave} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-30 hover:bg-slate-800">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function BlockDetailPage({ blockId, user, setPage }: { blockId: string; user: SeedUser; setPage: (p: string) => void }) {
  const { blocks, setBlocks, activities, setActivities, assets, setAssets } = useContext(AppContext);
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
      setBlocks(blocks.map((b) =>
        b.id === block.id ? { ...b, status: "client_files_under_review" as BlockStatus } : b
      ));
    }
  }, [assets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!block) return <EmptyState icon={Package} title="Bloco não encontrado" />;

  const contract = CONTRACTS.find((c) => c.id === block.contractId);
  const blockAssets = assets.filter((a) => a.blockId === block.id);
  const blockApprovals = APPROVALS.filter((a) => a.blockId === block.id);
  const blockActivities = activities.filter((a) => a.blockId === block.id).sort((a, b) => b.at.localeCompare(a.at));
  const readiness = checkReadiness(block.id, block.svc);
  const publication = PUBLICATIONS.find((p) => p.blockId === block.id);
  const validNext = VALID_TRANSITIONS[block.status] || [];
  const isClient = user.role === "client";
  const [confirmTransition, setConfirmTransition] = useState<BlockStatus | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const handleEditSave = (d: { title: string; sku: string; csku: string }) => {
    setBlocks(blocks.map((b) => b.id === block.id ? { ...b, title: d.title, sku: d.sku, csku: d.csku } : b));
    setActivities([...activities, { id: `al_${Date.now()}`, blockId: block.id, userId: user.id, type: "block_edited", desc: `Dados do bloco editados`, at: new Date().toISOString() }]);
    setShowEdit(false);
  };

  const MAX_REVISIONS = 3;
  const revisions = block.clientRevisions ?? 0;
  const revisionLimitReached = revisions >= MAX_REVISIONS;
  const revisionWarning = revisions === MAX_REVISIONS - 1;

  const handleTransition = (newStatus: BlockStatus) => {
    const updated = blocks.map((b) => b.id === block.id ? { ...b, status: newStatus, ...(newStatus === "published" ? { published: new Date().toISOString().slice(0, 10) } : {}) } : b);
    setBlocks(updated);
    const newAct: SeedActivity = {
      id: `al_${Date.now()}`, blockId: block.id, userId: user.id,
      type: "status_changed", desc: `Status: ${STATUS_LABELS[block.status]} → ${STATUS_LABELS[newStatus]}`,
      at: new Date().toISOString(),
    };
    setActivities([...activities, newAct]);
    setConfirmTransition(null);
  };

  // Rejeição do cliente = 1 revisão consumida
  const handleClientReject = (approvalId: string) => {
    if (revisionLimitReached) return; // bloqueado — revisão paga
    const updatedBlocks = blocks.map((b) =>
      b.id === block.id ? { ...b, clientRevisions: revisions + 1 } : b
    );
    setBlocks(updatedBlocks);
    const act: SeedActivity = {
      id: `al_${Date.now()}`, blockId: block.id, userId: user.id,
      type: "approval_rejected",
      desc: `Revisão ${revisions + 1}/${MAX_REVISIONS} solicitada pelo cliente`,
      at: new Date().toISOString(),
    };
    setActivities([...activities, act]);
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
            {user.role === "admin" && (
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
            {user.role === "admin" && (
              <button onClick={() => setShowEdit(true)} title="Editar dados do bloco" className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800">
                <Settings className="w-3 h-3" /> Editar
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
        {(["overview", "assets", "approvals", "activity", "publication"] as const).map((t) => (
          <TabBtn key={t} active={tab === t} label={{ overview: "Visão Geral", assets: "Arquivos", approvals: "Aprovações", activity: "Atividade", publication: "Publicação" }[t]} onClick={() => setTab(t)} />
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
                {!isClient && <div><p className="text-xs text-slate-400">Responsável</p><p className="font-medium text-slate-700">{block.owner ? getUserName(block.owner) : "Não atribuído"}</p></div>}
                {!isClient && <div><p className="text-xs text-slate-400">Backup</p><p className="font-medium text-slate-700">{block.backup ? getUserName(block.backup) : "—"}</p></div>}
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
            {!isClient && validNext.length > 0 && (
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
                  <div key={act.id} className="flex items-start gap-2 text-xs"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" /><div><p className="text-slate-600">{act.desc}</p><p className="text-slate-400">{isClient ? fmtDate(act.at) : `${getUserName(act.userId)} · ${fmtDate(act.at)}`}</p></div></div>
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
            setActivities((prev) => [...prev, {
              id: `al_${Date.now()}_${asset.id}`, blockId: block.id, userId: user.id,
              type: "asset_uploaded" as const,
              desc: `Arquivo enviado: ${asset.name} (${CATEGORY_LABELS[asset.cat]})`,
              at: new Date().toISOString(),
            }]);
          }}
        />
      )}

      {tab === "approvals" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Aprovações</h3>
          {blockApprovals.length === 0 ? <EmptyState icon={CheckCircle} title="Nenhuma aprovação" /> : (
            <div className="space-y-3">
              {blockApprovals.map((ap) => (
                <div key={ap.id} className={`border rounded-lg p-4 ${ap.status === "pending" ? "border-amber-200 bg-amber-50/50" : ap.status === "approved" ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{ap.type === "material_validation" ? "Validação de Material" : "Validação Final"}</span>
                    <Badge className={ap.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" : ap.status === "approved" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>
                      {ap.status === "pending" ? "Pendente" : ap.status === "approved" ? "Aprovado" : "Rejeitado"}
                    </Badge>
                  </div>
                  {ap.comment && <p className="text-sm text-slate-600 italic">&ldquo;{ap.comment}&rdquo;</p>}
                  <p className="text-xs text-slate-400 mt-1">Solicitado em {fmtDate(ap.at)}{!isClient && ap.decided ? ` · Decidido por ${getUserName(ap.decided)}` : ""}</p>
                  {ap.status === "pending" && isClient && (
                    <div className="space-y-2 mt-3">
                      <div className="flex gap-2">
                        <button className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700">
                          <ThumbsUp className="w-3.5 h-3.5" /> Aprovar
                        </button>
                        <button
                          onClick={() => handleClientReject(ap.id)}
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
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "activity" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Timeline</h3>
          {blockActivities.length === 0 ? <EmptyState icon={Activity} title="Sem atividade" /> : (
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
              {blockActivities.map((act) => (
                <div key={act.id} className="relative"><div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" /><p className="text-sm text-slate-700">{act.desc}</p><p className="text-xs text-slate-400 mt-0.5">{getUserName(act.userId)} · {fmtDate(act.at)}</p></div>
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
  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?.id ?? "");
  const [t, setT] = useState(initial?.title ?? "");
  const [tb, setTb] = useState(String(initial?.totalBlocks ?? 10));
  const [ub, setUb] = useState(String(initial?.usedBlocks ?? 0));
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
            <div><label className="text-xs font-medium text-slate-500">Já Utilizados</label><input type="number" value={ub} onChange={(e) => setUb(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
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
  const { contracts, setContracts, clients, currentUser } = useContext(AppContext);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SeedContract | null>(null);
  const canEdit = currentUser?.role === "admin";
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
        {canEdit && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"><Plus className="w-3.5 h-3.5" /> Novo Contrato</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ctrs.map((ct) => {
          const cl = clients.find((c) => c.id === ct.clientId);
          const pct = ct.totalBlocks > 0 ? Math.round((ct.usedBlocks / ct.totalBlocks) * 100) : 0;
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
                <div className="flex items-center justify-between text-sm mb-2"><span className="text-slate-500">{ct.usedBlocks} / {ct.totalBlocks} blocos</span><span className="font-bold text-slate-700">{pct}%</span></div>
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
  return (
    <div className="space-y-4">
      <button onClick={() => setPage("contracts")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div><h1 className="text-xl font-bold text-slate-800">{ct.title}</h1><p className="text-sm text-slate-500">{cl?.name} · Início: {fmtDate(ct.startDate)}</p></div>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard icon={FileText} label="Contratados" value={ct.totalBlocks} />
        <MetricCard icon={Package} label="Utilizados" value={ct.usedBlocks} />
        <MetricCard icon={Box} label="Disponíveis" value={ct.totalBlocks - ct.usedBlocks} color="text-emerald-600" />
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
  const canEdit = currentUser?.role === "admin";

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
        {canEdit && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"><Plus className="w-3.5 h-3.5" /> Novo Cliente</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clients.map((cl) => {
          const ctrs = contracts.filter((c) => c.clientId === cl.id);
          const total = ctrs.reduce((s, c) => s + c.totalBlocks, 0);
          const used = ctrs.reduce((s, c) => s + c.usedBlocks, 0);
          const cnt = blocks.filter((b) => b.clientId === cl.id).length;
          return (
            <Card key={cl.id} className={`p-5 ${!cl.active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">{cl.code.slice(0, 2).toUpperCase()}</div>
                  <div><p className="text-sm font-semibold text-slate-800">{cl.name}</p><p className="text-xs text-slate-400 font-mono">{cl.code}</p></div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(cl)} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100"><Settings className="w-3.5 h-3.5 text-slate-400" /></button>
                    <button onClick={() => toggleActive(cl.id)} title={cl.active ? "Desativar" : "Reativar"} className="p-1.5 rounded-lg hover:bg-slate-100">{cl.active ? <X className="w-3.5 h-3.5 text-red-500" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}</button>
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
  const isClient = user.role === "client";
  const [tab, setTab] = useState("pending");
  const { blocks } = useContext(AppContext);
  const relevant = isClient ? APPROVALS.filter((a) => blocks.find((b) => b.id === a.blockId)?.clientId === user.clientId) : APPROVALS;
  const pending = relevant.filter((a) => a.status === "pending");
  const resolved = relevant.filter((a) => a.status !== "pending");
  const list = tab === "pending" ? pending : resolved;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Aprovações</h1>
      <div className="flex gap-2"><TabBtn active={tab === "pending"} label="Pendentes" count={pending.length} onClick={() => setTab("pending")} /><TabBtn active={tab === "resolved"} label="Resolvidas" count={resolved.length} onClick={() => setTab("resolved")} /></div>
      <div className="space-y-3">
        {list.length === 0 ? <Card className="p-8"><EmptyState icon={CheckCircle} title={tab === "pending" ? "Nenhuma aprovação pendente" : "Nenhuma resolvida"} /></Card> : list.map((ap) => {
          const block = blocks.find((b) => b.id === ap.blockId);
          return (
            <Card key={ap.id} className={`p-5 border-l-4 ${ap.status === "pending" ? "border-l-amber-400" : ap.status === "approved" ? "border-l-green-400" : "border-l-red-400"}`}>
              <div className="flex items-start justify-between">
                <div><p className="text-sm font-semibold text-slate-800">{block?.title || "—"}</p><p className="text-xs text-slate-400 mt-0.5">{ap.type === "material_validation" ? "Validação de Material" : "Validação Final"} · {block?.sku}</p></div>
                <Badge className={ap.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" : ap.status === "approved" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}>{ap.status === "pending" ? "Pendente" : ap.status === "approved" ? "Aprovado" : "Rejeitado"}</Badge>
              </div>
              {ap.comment && <p className="text-sm text-slate-600 mt-2 italic bg-slate-50 p-2 rounded">&ldquo;{ap.comment}&rdquo;</p>}
              <p className="text-xs text-slate-400 mt-2">Solicitado por {getUserName(ap.by)} em {fmtDate(ap.at)}</p>
              {ap.status === "pending" && isClient && (
                <div className="flex gap-2 mt-3">
                  <button className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"><ThumbsUp className="w-3.5 h-3.5" /> Aprovar</button>
                  <button className="flex items-center gap-1 px-4 py-2 bg-white text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-50"><ThumbsDown className="w-3.5 h-3.5" /> Rejeitar</button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
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

function ActivityPage() {
  const { activities } = useContext(AppContext);
  const { blocks } = useContext(AppContext);
  const sorted = [...activities].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Atividade Global</h1>
      <Card className="p-5">
        <div className="relative pl-6 space-y-4">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
          {sorted.map((act) => {
            const block = blocks.find((b) => b.id === act.blockId);
            return (
              <div key={act.id} className="relative"><div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" />
                <p className="text-sm text-slate-700">{act.desc}</p>
                <p className="text-xs text-slate-400 mt-0.5">{getUserName(act.userId)} · <span className="font-mono">{block?.sku}</span> · {fmtDate(act.at)}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function UserFormModal({
  title, onClose, onSave, initial,
}: {
  title: string;
  onClose: () => void;
  onSave: (data: { name: string; email: string; role: UserRole; clientId: string; password: string }) => void;
  initial?: SeedUser;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<UserRole>(initial?.role ?? "internal_ops");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [showPw, setShowPw] = useState(false);

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
            <label className="block text-xs font-medium text-slate-500 mb-1">Perfil</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
              {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {role === "client" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                <option value="">Selecione...</option>
                {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={() => onSave({ name: name.trim(), email: email.trim(), role, clientId, password })}
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
  const { currentUser } = useContext(AppContext);
  const [users, setUsers] = useState<SeedUser[]>([...USERS]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<SeedUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleAdd = (data: { name: string; email: string; role: UserRole; clientId: string; password: string }) => {
    const u: SeedUser = {
      id: `u_${Date.now()}`, name: data.name, email: data.email, password: data.password,
      role: data.role, active: true, ...(data.role === "client" && data.clientId ? { clientId: data.clientId } : {}),
    };
    setUsers([...users, u]);
    USERS.push(u);
    setShowAdd(false);
  };

  const handleEdit = (data: { name: string; email: string; role: UserRole; clientId: string; password: string }) => {
    if (!editingUser) return;
    const updated = users.map((u) =>
      u.id === editingUser.id
        ? { ...u, name: data.name, email: data.email, role: data.role, password: data.password, clientId: data.role === "client" && data.clientId ? data.clientId : undefined }
        : u
    );
    setUsers(updated);
    const idx = USERS.findIndex((u) => u.id === editingUser.id);
    if (idx >= 0) {
      USERS[idx] = { ...USERS[idx], name: data.name, email: data.email, role: data.role, password: data.password,
        clientId: data.role === "client" && data.clientId ? data.clientId : undefined };
    }
    setEditingUser(null);
  };

  const handleDelete = (id: string) => {
    setUsers(users.filter((u) => u.id !== id));
    const idx = USERS.findIndex((u) => u.id === id);
    if (idx >= 0) USERS.splice(idx, 1);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-800">Usuários</h1><p className="text-sm text-slate-500">{users.length} registrados</p></div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"><Plus className="w-3.5 h-3.5" /> Novo Usuário</button>
      </div>
      <Card>
        <DataTable data={users} columns={[
          { label: "Nome", render: (r: SeedUser) => <p className="text-sm font-medium text-slate-800">{r.name}</p> },
          { label: "Email", render: (r: SeedUser) => <span className="text-sm text-slate-500">{r.email}</span> },
          { label: "Perfil", render: (r: SeedUser) => <Badge className={r.role === "admin" ? "bg-purple-50 text-purple-700 border-purple-200" : r.role === "client" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"}>{ROLE_LABELS[r.role]}</Badge> },
          { label: "Cliente", render: (r: SeedUser) => r.clientId ? getClientName(r.clientId) : "\u2014" },
          { label: "Ações", render: (r: SeedUser) => confirmDelete === r.id ? (
            <div className="flex gap-1">
              <button onClick={() => handleDelete(r.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Confirmar</button>
              <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300">Cancelar</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingUser(r)} className="text-xs text-slate-500 hover:text-slate-800 hover:underline">Editar</button>
              <span className="text-slate-200">|</span>
              <button onClick={() => setConfirmDelete(r.id)} className="text-xs text-red-500 hover:text-red-700 hover:underline">Remover</button>
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
const TICKET_STATUS_LABELS: Record<TicketStatus, string> = { new: "Novo", in_production: "Em Produção", internal_review: "Revisão Interna", delivered: "Entregue" };
const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  new: "border-slate-200/80 bg-slate-100/90 text-slate-600",
  in_production: "border-violet-200/80 bg-violet-50 text-violet-700",
  internal_review: "border-amber-200/80 bg-amber-50 text-amber-700",
  delivered: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
};

function NewTicketModal({ onClose, onSave }: { onClose: () => void; onSave: (t: ProductionTicket) => void }) {
  const { blocks } = useContext(AppContext);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [slaDate, setSlaDate] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [plan, setPlan] = useState<ServiceType>("standard");

  const internalUsers = USERS.filter((u) => u.role !== "client" && u.active);
  const clientBlocks = blocks.filter((b) => b.clientId === clientId);
  const selectedBlock = blocks.find((b) => b.id === blockId);

  const canSave = title.trim() && clientId && slaDate;

  const handleSave = () => {
    const t: ProductionTicket = {
      id: `tk_${Date.now()}`,
      clientId,
      blockId: blockId || "",
      title: title.trim(),
      plan,
      slaDate,
      priority,
      assignedTo: assignedTo || undefined,
      status: "new",
    };
    onSave(t);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="font-semibold text-slate-900">Novo Ticket de Produção</p>
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
              <select value={clientId} onChange={(e) => { setClientId(e.target.value); setBlockId(""); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition">
                <option value="">Selecionar...</option>
                {CLIENTS.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Bloco</label>
              <select value={blockId} onChange={(e) => setBlockId(e.target.value)} disabled={!clientId} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition disabled:opacity-50">
                <option value="">Nenhum</option>
                {clientBlocks.map((b) => <option key={b.id} value={b.id}>#{b.n} · {b.title}</option>)}
              </select>
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
              <input type="date" value={slaDate} onChange={(e) => setSlaDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-400 transition" />
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
          {selectedBlock && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2">Bloco: {selectedBlock.sku} · {selectedBlock.csku} · Status atual: {selectedBlock.status}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition">Cancelar</button>
          <button onClick={handleSave} disabled={!canSave} className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-sm font-semibold text-slate-900 disabled:opacity-30 hover:brightness-110 transition">Criar Ticket</button>
        </div>
      </div>
    </div>
  );
}

function ProductionTicketsPage({ user }: { user: SeedUser }) {
  const { blocks, tickets, setTickets } = useContext(AppContext);
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const [showNewTicket, setShowNewTicket] = useState(false);

  const isClient = user.role === "client";
  const visible = tickets.filter((t) => {
    if (isClient && t.clientId !== user.clientId) return false;
    if (filter !== "all" && t.status !== filter) return false;
    return true;
  });

  const createTicket = (t: ProductionTicket) => {
    const updated = [...tickets, t];
    setTickets(updated);
  };

  const updateStatus = (id: string, status: TicketStatus) => {
    const updated = tickets.map((t) => t.id === id ? { ...t, status } : t);
    setTickets(updated);
  };

  const assignTicket = (id: string, userId: string) => {
    const updated = tickets.map((t) => t.id === id ? { ...t, assignedTo: userId } : t);
    setTickets(updated);
  };

  const internalUsers = USERS.filter((u) => u.role !== "client" && u.active);
  const counts = { all: tickets.filter((t) => !isClient || t.clientId === user.clientId).length, new: 0, in_production: 0, internal_review: 0, delivered: 0 };
  tickets.filter((t) => !isClient || t.clientId === user.clientId).forEach((t) => { counts[t.status]++; });

  return (
    <div className="space-y-6">
      {showNewTicket && <NewTicketModal onClose={() => setShowNewTicket(false)} onSave={createTicket} />}
      <SectionHeader
        eyebrow="Fase 5 · Produção"
        title="Tickets de produção"
        description="Cada ticket representa um bloco 3D em produção, com SLA, responsável e status atualizado."
        action={
          <div className="flex items-center gap-2">
            <Badge className="border-slate-200/80 bg-white/80 text-slate-600">{counts.all} tickets</Badge>
            {!isClient && (
              <button onClick={() => setShowNewTicket(true)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:brightness-110 transition">
                <Plus className="w-3.5 h-3.5" /> Novo Ticket
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {([["all", "Todos", counts.all], ["new", "Novos", counts.new], ["in_production", "Em Produção", counts.in_production], ["internal_review", "Revisão", counts.internal_review], ["delivered", "Entregues", counts.delivered]] as const).map(([id, label, count]) => (
          <TabBtn key={id} active={filter === id} label={label} count={count} onClick={() => setFilter(id)} />
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="p-4"><EmptyState icon={Hash} title="Nenhum ticket encontrado" desc="Não há tickets para o filtro selecionado." /></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((ticket) => {
            const block = blocks.find((b) => b.id === ticket.blockId);
            const client = CLIENTS.find((c) => c.id === ticket.clientId);
            const assignedUser = USERS.find((u) => u.id === ticket.assignedTo);
            const slaDate = new Date(ticket.slaDate);
            const daysLeft = Math.ceil((slaDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const slaUrgent = daysLeft <= 3;

            return (
              <Card key={ticket.id} className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className={TICKET_STATUS_COLORS[ticket.status]}>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                      <ServiceBadge type={ticket.plan} />
                      <PriorityDot priority={ticket.priority} />
                    </div>
                    <p className="text-base font-semibold text-slate-900">{ticket.title}</p>
                    <p className="text-sm text-slate-500 mt-1">{client?.name} · Bloco #{block?.n || "—"} · {block?.sku || ticket.blockId}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${slaUrgent ? "text-rose-600" : "text-slate-700"}`}>
                      {slaUrgent ? `⚠ ${daysLeft}d restantes` : `${daysLeft}d até SLA`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">SLA: {fmtDate(ticket.slaDate)}</p>
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

function PublicationsPage({ user }: { user: SeedUser }) {
  const { blocks, publications, setPublications, clients, currentUser } = useContext(AppContext);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SeedPub | null>(null);
  const canEdit = currentUser?.role === "admin";
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
            {canEdit && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:brightness-110 transition"><Plus className="w-3.5 h-3.5" /> Nova Publicação</button>}
          </div>
        }
      />

      {pubs.length === 0 ? (
        <Card className="p-4"><EmptyState icon={Globe} title="Nenhuma publicação ainda" desc={canEdit ? "Clique em 'Nova Publicação' para adicionar manualmente." : "Seus blocos aparecerão aqui após aprovação e publicação pela equipe ArchTechTour."} /></Card>
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
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(pub)} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100"><Settings className="w-3.5 h-3.5 text-slate-400" /></button>
                      <button onClick={() => handleDelete(pub.id)} title="Remover" className="p-1.5 rounded-lg hover:bg-red-50"><X className="w-3.5 h-3.5 text-red-500" /></button>
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
            <button
              onClick={() => setTab("manage")}
              className="rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
              title="Listar/adicionar clientes na dim_client_alias do Athena"
            >
              Gerenciar clientes
            </button>
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
}: {
  currentUser: SeedUser;
  setCurrentUser: (u: SeedUser | null) => void;
  setPage: (p: string) => void;
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
      <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm transition hover:text-slate-700">
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-rose-500" />
      </button>
      <button
        onClick={() => { setCurrentUser(null); setPage("dashboard"); }}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:text-rose-600"
      >
        <LogOut className="h-4 w-4" />
        {t("portal.logout")}
      </button>
    </div>
  );
}

// ============================================================
// MAIN PORTAL
// ============================================================
export default function Portal() {
  const [currentUser, setCurrentUser] = useState<SeedUser | null>(null);
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState("");
  const [selectedContract, setSelectedContract] = useState("");
  const [blocks, setBlocks] = useState<SeedBlock[]>(INITIAL_BLOCKS);
  const [activities, setActivities] = useState<SeedActivity[]>(ACTIVITIES);
  const [assets, setAssets] = useState<SeedAsset[]>([...ASSETS]);
  const [tickets, setTickets] = useState<ProductionTicket[]>(TICKETS);
  const [clients, setClients] = useState<SeedClient[]>(CLIENTS);
  const [contracts, setContracts] = useState<SeedContract[]>(CONTRACTS);
  const [publications, setPublications] = useState<SeedPub[]>(PUBLICATIONS);
  const [users, setUsers] = useState<SeedUser[]>(USERS);
  const [hydrated, setHydrated] = useState(false);

  // Load mutable state from DynamoDB on mount. Seed tables on first use.
  useEffect(() => {
    (async () => {
      try {
        const [bRes, tRes, aRes, cRes, ctrRes, pubRes, uRes] = await Promise.all([
          fetch("/api/state/blocks").then((r) => r.json()),
          fetch("/api/state/tickets").then((r) => r.json()),
          fetch("/api/state/activities").then((r) => r.json()),
          fetch("/api/state/clients").then((r) => r.json()),
          fetch("/api/state/contracts").then((r) => r.json()),
          fetch("/api/state/publications").then((r) => r.json()),
          fetch("/api/state/users").then((r) => r.json()),
        ]);

        // Se DB tem dados → usa. Senão → seed inicial.
        if (bRes.items?.length) setBlocks(bRes.items);
        else { await fetch("/api/state/blocks", { method: "POST", body: JSON.stringify(INITIAL_BLOCKS) }); }

        if (tRes.items?.length) { setTickets(tRes.items); TICKETS = tRes.items; }
        else { await fetch("/api/state/tickets", { method: "POST", body: JSON.stringify(TICKETS) }); }

        if (aRes.items?.length) setActivities(aRes.items);
        else { await fetch("/api/state/activities", { method: "POST", body: JSON.stringify(ACTIVITIES) }); }

        if (cRes.items?.length) { setClients(cRes.items); CLIENTS = cRes.items; }
        else { await fetch("/api/state/clients", { method: "POST", body: JSON.stringify(CLIENTS) }); }

        if (ctrRes.items?.length) { setContracts(ctrRes.items); CONTRACTS = ctrRes.items; }
        else { await fetch("/api/state/contracts", { method: "POST", body: JSON.stringify(CONTRACTS) }); }

        if (pubRes.items?.length) setPublications(pubRes.items);
        else { await fetch("/api/state/publications", { method: "POST", body: JSON.stringify(PUBLICATIONS) }); }

        if (uRes.items?.length) { setUsers(uRes.items); USERS.length = 0; USERS.push(...uRes.items); }
        else { await fetch("/api/state/users", { method: "POST", body: JSON.stringify(USERS) }); }
      } catch (e) { console.error("Failed to load state:", e); }
      setHydrated(true);
    })();
  }, []);

  // Persistência DynamoDB com debounce 800ms (anti-flood)
  useEffect(() => { if (!hydrated) return; const t = setTimeout(() => { fetch("/api/state/blocks", { method: "POST", body: JSON.stringify(blocks) }).catch(() => {}); }, 800); return () => clearTimeout(t); }, [blocks, hydrated]);
  useEffect(() => { if (!hydrated) return; TICKETS = tickets; const t = setTimeout(() => { fetch("/api/state/tickets", { method: "POST", body: JSON.stringify(tickets) }).catch(() => {}); }, 800); return () => clearTimeout(t); }, [tickets, hydrated]);
  useEffect(() => { if (!hydrated) return; const t = setTimeout(() => { fetch("/api/state/activities", { method: "POST", body: JSON.stringify(activities) }).catch(() => {}); }, 800); return () => clearTimeout(t); }, [activities, hydrated]);
  useEffect(() => { if (!hydrated) return; CLIENTS = clients; const t = setTimeout(() => { fetch("/api/state/clients", { method: "POST", body: JSON.stringify(clients) }).catch(() => {}); }, 800); return () => clearTimeout(t); }, [clients, hydrated]);
  useEffect(() => { if (!hydrated) return; CONTRACTS = contracts; const t = setTimeout(() => { fetch("/api/state/contracts", { method: "POST", body: JSON.stringify(contracts) }).catch(() => {}); }, 800); return () => clearTimeout(t); }, [contracts, hydrated]);
  useEffect(() => { if (!hydrated) return; const t = setTimeout(() => { fetch("/api/state/publications", { method: "POST", body: JSON.stringify(publications) }).catch(() => {}); }, 800); return () => clearTimeout(t); }, [publications, hydrated]);
  useEffect(() => { if (!hydrated) return; USERS.length = 0; USERS.push(...users); const t = setTimeout(() => { fetch("/api/state/users", { method: "POST", body: JSON.stringify(users) }).catch(() => {}); }, 800); return () => clearTimeout(t); }, [users, hydrated]);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date()),
    [],
  );

  if (!currentUser) {
    return (
      <AppContext.Provider value={{ currentUser, setCurrentUser, blocks, setBlocks, activities, setActivities, assets, setAssets, tickets, setTickets, clients, setClients, contracts, setContracts, publications, setPublications, users, setUsers }}>
        <LoginPage />
      </AppContext.Provider>
    );
  }

  const isClient = currentUser.role === "client";
  const shellLabel = isClient ? "Portal do cliente" : "Operações internas";
  const workspaceTitle = isClient ? getClientName(currentUser.clientId!) : "Pipeline ArchTechTour";

  const renderPage = () => {
    switch (page) {
      case "dashboard": return isClient ? <ClientDashboard user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} /> : <InternalDashboard setPage={setPage} />;
      case "onboarding": return <OnboardingWizardPage user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "blocks": return <BlocksListPage user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "block_detail": return <BlockDetailPage blockId={selectedBlock} user={currentUser} setPage={setPage} />;
      case "contracts": return <ContractsPage user={currentUser} setPage={setPage} setSelectedContract={setSelectedContract} />;
      case "contract_detail": return <ContractDetailPage contractId={selectedContract} user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "clients": return <ClientsPage />;
      case "approvals": return <ApprovalsPage user={currentUser} />;
      case "queue": return <QueuePage user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "tickets": return <ProductionTicketsPage user={currentUser} />;
      case "publications": return <PublicationsPage user={currentUser} />;
      case "analytics": return <AnalyticsPage user={currentUser} />;
      case "activity": return <ActivityPage />;
      case "users": return <UsersPage />;
      case "agents": return <AgentsPage setPage={setPage} />;
      case "agent_sherlock_codes": return <SherlockCodesPage setPage={setPage} />;
      case "agent_monk_lighthouse": return <MonkLighthousePage setPage={setPage} />;
      case "agent_yoda_kanban": return <YodaKanbanPage setPage={setPage} />;
      case "agent_harvey_closer": return <HarveyCloserPage setPage={setPage} />;
      default: return <InternalDashboard setPage={setPage} />;
    }
  };

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, blocks, setBlocks, activities, setActivities, assets, setAssets, tickets, setTickets, clients, setClients, contracts, setContracts, publications, setPublications, users, setUsers }}>
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
              <PortalHeaderActions currentUser={currentUser} setCurrentUser={setCurrentUser} setPage={setPage} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-8">{renderPage()}</main>
        </div>
      </div>
    </AppContext.Provider>
  );
}

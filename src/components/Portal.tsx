"use client";
import { useState, useMemo, createContext, useContext, useCallback, ReactNode } from "react";
import {
  LayoutDashboard, Package, FileText, Users, CheckCircle, Activity,
  Globe, Search, Bell, LogOut, Menu, X, Plus, Upload, Clock,
  AlertTriangle, Eye, ChevronDown, ArrowLeft, Copy, Check, Layers,
  Settings, UserCheck, Clipboard, Box, FileUp, ExternalLink, Zap,
  Play, ThumbsUp, ThumbsDown, Hash, Pause, Lock, Archive,
  BarChart3, ChevronRight, Filter, MessageSquare
} from "lucide-react";

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

interface SeedUser {
  id: string; email: string; name: string; role: UserRole;
  clientId?: string; active: boolean;
}
interface SeedClient { id: string; name: string; code: string; contactEmail: string; active: boolean; }
interface SeedContract {
  id: string; clientId: string; title: string;
  totalBlocks: number; usedBlocks: number; startDate: string; active: boolean;
}
interface SeedBlock {
  id: string; clientId: string; contractId: string; n: number;
  sku: string; csku: string; title: string; desc?: string;
  svc: ServiceType; status: BlockStatus; pri: Priority;
  owner?: string; backup?: string; created: string; published?: string;
}
interface SeedAsset {
  id: string; blockId: string; cat: AssetCategory;
  name: string; size: number; v: number; by: string;
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
interface SeedPub {
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
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  awaiting_client_files: "bg-amber-50 text-amber-700 border-amber-200",
  client_files_under_review: "bg-sky-50 text-sky-700 border-sky-200",
  ready_to_start: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_modeling: "bg-violet-50 text-violet-700 border-violet-200",
  awaiting_client_material_validation: "bg-orange-50 text-orange-700 border-orange-200",
  approved_for_programming: "bg-cyan-50 text-cyan-700 border-cyan-200",
  in_programming: "bg-indigo-50 text-indigo-700 border-indigo-200",
  internal_review: "bg-pink-50 text-pink-700 border-pink-200",
  awaiting_client_final_validation: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  published: "bg-green-100 text-green-800 border-green-300",
  blocked: "bg-red-50 text-red-700 border-red-200",
  on_hold: "bg-slate-50 text-slate-500 border-slate-200",
  archived: "bg-slate-50 text-slate-400 border-slate-100",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "text-slate-400", normal: "text-blue-500", high: "text-orange-500", urgent: "text-red-500",
};
const PRIORITY_LABELS: Record<Priority, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
const SERVICE_LABELS: Record<ServiceType, string> = { standard: "Standard", plus: "Plus", ultra: "Ultra" };
const SERVICE_COLORS: Record<ServiceType, string> = { standard: "bg-slate-100 text-slate-600", plus: "bg-blue-100 text-blue-700", ultra: "bg-purple-100 text-purple-700" };
const ROLE_LABELS: Record<UserRole, string> = { admin: "Admin", internal_ops: "Operações", internal_modeling: "Modelagem", internal_programming: "Programação", client: "Cliente" };
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  cad: "CAD / Estrutural", finishing: "Acabamento / Material", photos: "Fotos",
  videos: "Vídeos", technical_drawing: "Desenho Técnico", "3d_block": "Bloco 3D",
  extra_reference: "Ref. Extra",
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
  { id: "u1", email: "mpesca@archtechtour.com", name: "Mariana Pesca", role: "admin", active: true },
  { id: "u2", email: "mpalhano@archtechtour.com", name: "Matheus Palhano", role: "admin", active: true },
  { id: "u3", email: "vsalles@archtechtour.com", name: "Victor Salles", role: "internal_modeling", active: true },
  { id: "u4", email: "ijesus@archtechtour.com", name: "Igor Augusto", role: "internal_modeling", active: true },
  { id: "u5", email: "lliles@archtechtour.com", name: "Lucas Liles", role: "internal_programming", active: true },
  { id: "u6", email: "info@archtechtour.com", name: "Jéssica Ribeiro", role: "internal_ops", active: true },
  { id: "u7", email: "financeiro@archtechtour.com", name: "Danielli Nunes", role: "internal_ops", active: true },
  { id: "u8", email: "contato@escal.com.br", name: "Escal Móveis", role: "client", clientId: "c1", active: true },
  { id: "u9", email: "contato@estudiobola.com.br", name: "Estúdio Bola", role: "client", clientId: "c2", active: true },
  { id: "u10", email: "contato@wentz.com.br", name: "Wentz", role: "client", clientId: "c3", active: true },
  { id: "u11", email: "contato@minimaldesign.com.br", name: "Minimal Design", role: "client", clientId: "c4", active: true },
  { id: "u12", email: "contato@rsdesign.com.br", name: "RS Design", role: "client", clientId: "c5", active: true },
];

const CLIENTS: SeedClient[] = [
  { id: "c1", name: "Escal Móveis", code: "ESCAL", contactEmail: "contato@escal.com.br", active: true },
  { id: "c2", name: "Estúdio Bola", code: "EB", contactEmail: "contato@estudiobola.com.br", active: true },
  { id: "c3", name: "Wentz", code: "WENTZ", contactEmail: "contato@wentz.com.br", active: true },
  { id: "c4", name: "Minimal Design", code: "MINIMAL", contactEmail: "contato@minimaldesign.com.br", active: true },
  { id: "c5", name: "RS Design", code: "RSDESIGN", contactEmail: "contato@rsdesign.com.br", active: true },
  { id: "c6", name: "Tidelli", code: "TIDELLI", contactEmail: "contato@tidelli.com.br", active: true },
  { id: "c7", name: "Hunter Douglas", code: "HD", contactEmail: "contato@hunterdouglas.com.br", active: true },
  { id: "c8", name: "Docol", code: "DOCOL", contactEmail: "contato@docol.com.br", active: true },
  { id: "c9", name: "Pedro Franco", code: "PF", contactEmail: "contato@pedrofranco.com.br", active: true },
  { id: "c10", name: "DEXCO", code: "DEXCO", contactEmail: "contato@dexco.com.br", active: true },
  { id: "c11", name: "WJ Luminárias", code: "WJ", contactEmail: "contato@wjluminarias.com.br", active: true },
  { id: "c12", name: "Christie", code: "CHRISTIE", contactEmail: "contato@christie.com.br", active: true },
];

const CONTRACTS: SeedContract[] = [
  { id: "ct1", clientId: "c1", title: "Contrato 2025 – Linha Completa", totalBlocks: 100, usedBlocks: 12, startDate: "2025-01-15", active: true },
  { id: "ct2", clientId: "c2", title: "Contrato Inicial – MVP", totalBlocks: 30, usedBlocks: 5, startDate: "2025-04-01", active: true },
  { id: "ct3", clientId: "c3", title: "Piloto Haus Concept", totalBlocks: 10, usedBlocks: 2, startDate: "2025-06-01", active: true },
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
  // WJ LUMINÁRIAS
  { id: "pb21", clientId: "c11", contractId: "ct8", n: 1, sku: "WJ-001", csku: "UMBRA", title: "Luminária Umbra", svc: "plus", status: "published", pri: "normal", owner: "u3", created: "2025-06-15", published: "2025-12-10" },
  { id: "pb22", clientId: "c11", contractId: "ct8", n: 2, sku: "WJ-002", csku: "PENDENTE-ARCO", title: "Pendente Arco", svc: "standard", status: "blocked", pri: "high", owner: "u4", created: "2025-08-01" },
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
  { id: "pub8", blockId: "pb21", url: "https://explorar.archtechtour.com/wj/ver-5/umbra/index.html", embed: '<iframe src="https://explorar.archtechtour.com/wj/ver-5/umbra/index.html" width="100%" height="600"></iframe>', env: "production", v: 5 },
];

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
  setBlocks: (b: SeedBlock[]) => void;
  activities: SeedActivity[];
  setActivities: (a: SeedActivity[]) => void;
}
const AppContext = createContext<AppState>({} as AppState);

// ============================================================
// BASE UI COMPONENTS
// ============================================================
function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: BlockStatus }) {
  return <Badge className={STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}>{STATUS_LABELS[status] || status}</Badge>;
}

function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${PRIORITY_COLORS[priority]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function ServiceBadge({ type }: { type: ServiceType }) {
  return <Badge className={SERVICE_COLORS[type]}>{SERVICE_LABELS[type]}</Badge>;
}

function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-white rounded-xl border border-slate-200/80 shadow-sm ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300 transition-all" : ""} ${className}`}>
      {children}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = "text-slate-700", onClick }: {
  icon: any; label: string; value: number | string; sub?: string; color?: string; onClick?: () => void;
}) {
  return (
    <Card className="p-5" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-lg bg-slate-50"><Icon className="w-5 h-5 text-slate-400" /></div>
      </div>
    </Card>
  );
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const color = value === 100 ? "bg-emerald-500" : value >= 60 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className={`w-full bg-slate-100 rounded-full h-2 ${className}`}>
      <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-slate-50 mb-4"><Icon className="w-8 h-8 text-slate-300" /></div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {desc && <p className="text-xs text-slate-400 mt-1 max-w-xs">{desc}</p>}
    </div>
  );
}

function TabBtn({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}>
      {label}
      {count !== undefined && <span className={`ml-1.5 text-xs ${active ? "text-slate-300" : "text-slate-400"}`}>({count})</span>}
    </button>
  );
}

function DataTable({ columns, data, onRowClick }: { columns: any[]; data: any[]; onRowClick?: (row: any) => void }) {
  if (!data.length) return <EmptyState icon={Clipboard} title="Nenhum registro encontrado" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col: any, i: number) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, ri: number) => (
            <tr key={ri} onClick={() => onRowClick?.(row)} className={`border-b border-slate-50 ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""} transition-colors`}>
              {columns.map((col: any, ci: number) => (
                <td key={ci} className="px-4 py-3 text-sm">{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage() {
  const { setCurrentUser } = useContext(AppContext);
  const [selected, setSelected] = useState<SeedUser | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Box className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">ArchTechTour</span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Portal de Operações</p>
        </div>
        <Card className="p-6">
          <p className="text-sm font-medium text-slate-700 mb-4">Selecione um usuário para entrar:</p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {USERS.map((u) => (
              <button key={u.id} onClick={() => setSelected(u)} className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between group ${selected?.id === u.id ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${selected?.id === u.id ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
                <Badge className={u.role === "client" ? "bg-blue-50 text-blue-600 border-blue-200" : u.role === "admin" ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-slate-100 text-slate-600 border-slate-200"}>
                  {ROLE_LABELS[u.role]}
                </Badge>
              </button>
            ))}
          </div>
          <button onClick={() => selected && setCurrentUser(selected)} disabled={!selected} className="w-full mt-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold disabled:opacity-40 hover:from-emerald-600 hover:to-cyan-600 transition-all shadow-sm">
            Entrar
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">MVP — Autenticação simplificada para demonstração</p>
        </Card>
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
  const isClient = user.role === "client";
  const pendingApprovals = APPROVALS.filter((a) => a.status === "pending").length;

  const navItems = isClient
    ? [
        { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { id: "blocks", icon: Package, label: "Meus Blocos" },
        { id: "contracts", icon: FileText, label: "Contratos" },
        { id: "approvals", icon: CheckCircle, label: "Aprovações", badge: pendingApprovals },
      ]
    : [
        { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { id: "queue", icon: Layers, label: "Fila de Trabalho" },
        { id: "blocks", icon: Package, label: "Todos os Blocos" },
        { id: "approvals", icon: CheckCircle, label: "Aprovações", badge: pendingApprovals },
        { id: "clients", icon: Users, label: "Clientes" },
        { id: "contracts", icon: FileText, label: "Contratos" },
        { id: "activity", icon: Activity, label: "Atividade" },
        { id: "users", icon: Settings, label: "Usuários" },
      ];

  return (
    <aside className={`fixed left-0 top-0 h-full bg-slate-900 text-white z-40 transition-all duration-300 flex flex-col ${collapsed ? "w-[64px]" : "w-[240px]"}`}>
      <div className="px-4 py-4 flex items-center gap-2 border-b border-slate-800/60">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <Box className="w-4 h-4 text-white" />
        </div>
        {!collapsed && <span className="text-sm font-bold tracking-tight">ArchTechTour</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
          {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => setPage(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${page === item.id ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
            {!collapsed && item.badge !== undefined && item.badge > 0 && (
              <span className="bg-red-500 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full font-bold">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800/60">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
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

  const pipeline = [
    { s: "awaiting_client_files" as BlockStatus, icon: Clock, color: "text-amber-500" },
    { s: "ready_to_start" as BlockStatus, icon: Play, color: "text-emerald-500" },
    { s: "in_modeling" as BlockStatus, icon: Layers, color: "text-violet-500" },
    { s: "in_programming" as BlockStatus, icon: Zap, color: "text-indigo-500" },
    { s: "internal_review" as BlockStatus, icon: Eye, color: "text-pink-500" },
    { s: "awaiting_client_final_validation" as BlockStatus, icon: UserCheck, color: "text-amber-500" },
    { s: "approved" as BlockStatus, icon: ThumbsUp, color: "text-green-500" },
    { s: "published" as BlockStatus, icon: Globe, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold text-slate-800">Dashboard Interno</h1><p className="text-sm text-slate-500 mt-0.5">Visão geral do pipeline de produção</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Package} label="Total Blocos" value={blocks.length} />
        <MetricCard icon={AlertTriangle} label="Bloqueados" value={byStatus["blocked"] || 0} color="text-red-600" />
        <MetricCard icon={CheckCircle} label="Aprovações Pendentes" value={pending} color="text-amber-600" />
        <MetricCard icon={Globe} label="Publicados" value={byStatus["published"] || 0} color="text-green-600" />
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Pipeline de Produção</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {pipeline.map(({ s, icon: Icon, color }) => (
            <button key={s} onClick={() => setPage("blocks")} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left">
              <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
              <div><p className="text-lg font-bold text-slate-800">{byStatus[s] || 0}</p><p className="text-xs text-slate-500 leading-tight">{STATUS_LABELS[s]}</p></div>
            </button>
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Blocos por Cliente</h3>
          {CLIENTS.map((cl) => {
            const count = blocks.filter((b) => b.clientId === cl.id).length;
            return (
              <div key={cl.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{cl.code.slice(0, 2)}</div>
                  <span className="text-sm font-medium text-slate-700">{cl.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{count}</span>
              </div>
            );
          })}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Atividade Recente</h3>
            <button onClick={() => setPage("activity")} className="text-xs text-blue-600 hover:underline">Ver tudo</button>
          </div>
          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {recent.map((act) => (
              <div key={act.id} className="flex items-start gap-2.5 text-xs">
                <Activity className="w-3.5 h-3.5 text-slate-300 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-slate-600 truncate">{act.desc}</p><p className="text-slate-400">{getUserName(act.userId)} · {fmtDate(act.at)}</p></div>
              </div>
            ))}
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
  const byStatus: Record<string, number> = {};
  myBlocks.forEach((b) => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold text-slate-800">Olá, {user.name.split(" ")[0]}!</h1><p className="text-sm text-slate-500">{getClientName(cid)}</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={FileText} label="Contratados" value={contracted} />
        <MetricCard icon={Package} label="Utilizados" value={used} />
        <MetricCard icon={Box} label="Disponíveis" value={contracted - used} color="text-emerald-600" />
        <MetricCard icon={AlertTriangle} label="Aguardando Ação" value={awaiting} color="text-amber-600" />
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Meus Blocos por Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([st, cnt]) => (
            <div key={st} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
              <StatusBadge status={st as BlockStatus} /><span className="text-sm font-bold text-slate-700">{cnt}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Blocos Recentes</h3>
          <button onClick={() => setPage("blocks")} className="text-xs text-blue-600 hover:underline">Ver todos</button>
        </div>
        {myBlocks.slice(0, 5).map((b) => (
          <div key={b.id} onClick={() => { setSelectedBlock(b.id); setPage("block_detail"); }} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded transition-colors">
            <div><p className="text-sm font-medium text-slate-700">{b.title}</p><p className="text-xs text-slate-400">{b.csku}</p></div>
            <StatusBadge status={b.status} />
          </div>
        ))}
      </Card>
      <Card className="p-5 border-l-4 border-l-emerald-400">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50"><Upload className="w-5 h-5 text-emerald-600" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-700">Enviar Materiais</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">Envie CAD, acabamentos, fotos e outros materiais para seus blocos em andamento.</p>
            <button onClick={() => setPage("blocks")} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors">
              <FileUp className="w-3.5 h-3.5" /> Ir para Meus Blocos
            </button>
          </div>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Precisa de ajuda?</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500"><MessageSquare className="w-3.5 h-3.5 text-slate-400" /> Contato: info@archtechtour.com</div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><Globe className="w-3.5 h-3.5 text-slate-400" /> www.archtechtour.com</div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// BLOCKS LIST
// ============================================================
function BlocksListPage({ user, setPage, setSelectedBlock }: { user: SeedUser; setPage: (p: string) => void; setSelectedBlock: (id: string) => void }) {
  const { blocks, setBlocks, activities, setActivities } = useContext(AppContext);
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

  const handleCreateBlock = (data: { title: string; clientSku: string; clientId: string; contractId: string; serviceType: ServiceType; priority: Priority }) => {
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
    setShowCreateModal(false);
    setSelectedBlock(newBlock.id);
    setPage("block_detail");
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
          { label: "Responsável", render: (r: SeedBlock) => <span className="text-xs text-slate-500">{r.owner ? getUserName(r.owner) : "—"}</span> },
        ]} />
      </Card>

      {/* Modal Criar Bloco */}
      {showCreateModal && <CreateBlockModal user={user} onClose={() => setShowCreateModal(false)} onCreate={handleCreateBlock} />}
    </div>
  );
}

// --- Create Block Modal ---
function CreateBlockModal({ user, onClose, onCreate }: {
  user: SeedUser;
  onClose: () => void;
  onCreate: (data: { title: string; clientSku: string; clientId: string; contractId: string; serviceType: ServiceType; priority: Priority }) => void;
}) {
  const isClient = user.role === "client";
  const [title, setTitle] = useState("");
  const [clientSku, setClientSku] = useState("");
  const [clientId, setClientId] = useState(isClient ? user.clientId || "" : "");
  const [contractId, setContractId] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("standard");
  const [priority, setPriority] = useState<Priority>("normal");

  const availableContracts = CONTRACTS.filter((c) => c.clientId === clientId && c.active);
  const selectedContract = CONTRACTS.find((c) => c.id === contractId);
  const hasCapacity = selectedContract ? selectedContract.usedBlocks < selectedContract.totalBlocks : false;
  const canSubmit = title.trim() && clientSku.trim() && clientId && contractId && hasCapacity;

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
              <select value={clientId} onChange={(e) => { setClientId(e.target.value); setContractId(""); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
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
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
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
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600 mb-1">Materiais obrigatórios ({SERVICE_LABELS[serviceType]}):</p>
            <div className="flex flex-wrap gap-1.5">
              {(READINESS_RULES[serviceType] || []).map((cat) => (
                <span key={cat} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600">{CATEGORY_LABELS[cat]}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
          <button onClick={() => canSubmit && onCreate({ title: title.trim(), clientSku: clientSku.trim(), clientId, contractId, serviceType, priority })} disabled={!canSubmit} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors">
            Criar Bloco
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BLOCK DETAIL
// ============================================================
function BlockDetailPage({ blockId, user, setPage }: { blockId: string; user: SeedUser; setPage: (p: string) => void }) {
  const { blocks, setBlocks, activities, setActivities } = useContext(AppContext);
  const block = blocks.find((b) => b.id === blockId);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("overview");

  if (!block) return <EmptyState icon={Package} title="Bloco não encontrado" />;

  const contract = CONTRACTS.find((c) => c.id === block.contractId);
  const blockAssets = ASSETS.filter((a) => a.blockId === block.id);
  const blockApprovals = APPROVALS.filter((a) => a.blockId === block.id);
  const blockActivities = activities.filter((a) => a.blockId === block.id).sort((a, b) => b.at.localeCompare(a.at));
  const readiness = checkReadiness(block.id, block.svc);
  const publication = PUBLICATIONS.find((p) => p.blockId === block.id);
  const validNext = VALID_TRANSITIONS[block.status] || [];
  const isClient = user.role === "client";
  const [confirmTransition, setConfirmTransition] = useState<BlockStatus | null>(null);

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

  const copyEmbed = () => {
    if (publication?.embed) { navigator.clipboard?.writeText(publication.embed); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setPage("blocks")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap"><h1 className="text-xl font-bold text-slate-800">{block.title}</h1><StatusBadge status={block.status} /></div>
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
                <div><p className="text-xs text-slate-400">Bloco Interno Nº</p><p className="font-medium text-slate-700">#{block.n}</p></div>
                <div><p className="text-xs text-slate-400">Criado em</p><p className="font-medium text-slate-700">{fmtDate(block.created)}</p></div>
                <div><p className="text-xs text-slate-400">Responsável</p><p className="font-medium text-slate-700">{block.owner ? getUserName(block.owner) : "Não atribuído"}</p></div>
                <div><p className="text-xs text-slate-400">Backup</p><p className="font-medium text-slate-700">{block.backup ? getUserName(block.backup) : "—"}</p></div>
                {block.published && <div><p className="text-xs text-slate-400">Publicado em</p><p className="font-medium text-slate-700">{fmtDate(block.published)}</p></div>}
              </div>
            </Card>
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
                  <div key={act.id} className="flex items-start gap-2 text-xs"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" /><div><p className="text-slate-600">{act.desc}</p><p className="text-slate-400">{getUserName(act.userId)} · {fmtDate(act.at)}</p></div></div>
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
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"><Upload className="w-3.5 h-3.5" /> Upload</button>
          </div>
          {blockAssets.length === 0 ? <EmptyState icon={FileUp} title="Nenhum arquivo enviado" desc="Faça upload dos materiais necessários." /> : (
            <div className="space-y-3">
              {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((cat) => {
                const catAssets = blockAssets.filter((a) => a.cat === cat);
                if (!catAssets.length) return null;
                return (
                  <div key={cat} className="border border-slate-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{CATEGORY_LABELS[cat]}</p>
                    {catAssets.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-700">{a.name}</span><Badge className="bg-slate-100 text-slate-500 border-slate-200">v{a.v}</Badge></div>
                        <span className="text-xs text-slate-400">{fmtSize(a.size)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
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
                  <p className="text-xs text-slate-400 mt-1">Solicitado por {getUserName(ap.by)} em {fmtDate(ap.at)}{ap.decided && ` · Decidido por ${getUserName(ap.decided)}`}</p>
                  {ap.status === "pending" && isClient && (
                    <div className="flex gap-2 mt-3">
                      <button className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"><ThumbsUp className="w-3.5 h-3.5" /> Aprovar</button>
                      <button className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-50"><ThumbsDown className="w-3.5 h-3.5" /> Rejeitar</button>
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
function ContractsPage({ user, setPage, setSelectedContract }: { user: SeedUser; setPage: (p: string) => void; setSelectedContract: (id: string) => void }) {
  const ctrs = user.role === "client" ? CONTRACTS.filter((c) => c.clientId === user.clientId) : CONTRACTS;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Contratos</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ctrs.map((ct) => {
          const cl = CLIENTS.find((c) => c.id === ct.clientId);
          const pct = ct.totalBlocks > 0 ? Math.round((ct.usedBlocks / ct.totalBlocks) * 100) : 0;
          return (
            <Card key={ct.id} className="p-5" onClick={() => { setSelectedContract(ct.id); setPage("contract_detail"); }}>
              <div className="flex items-start justify-between mb-3">
                <div><p className="text-sm font-semibold text-slate-800">{ct.title}</p>{user.role !== "client" && <p className="text-xs text-slate-400 mt-0.5">{cl?.name}</p>}</div>
                <Badge className="bg-green-50 text-green-700 border-green-200">Ativo</Badge>
              </div>
              <div className="flex items-center justify-between text-sm mb-2"><span className="text-slate-500">{ct.usedBlocks} / {ct.totalBlocks} blocos</span><span className="font-bold text-slate-700">{pct}%</span></div>
              <ProgressBar value={pct} />
              <p className="text-xs text-slate-400 mt-3">Início: {fmtDate(ct.startDate)}</p>
            </Card>
          );
        })}
      </div>
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

function ClientsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Clientes</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CLIENTS.map((cl) => {
          const ctrs = CONTRACTS.filter((c) => c.clientId === cl.id);
          const total = ctrs.reduce((s, c) => s + c.totalBlocks, 0);
          const used = ctrs.reduce((s, c) => s + c.usedBlocks, 0);
          const cnt = INITIAL_BLOCKS.filter((b) => b.clientId === cl.id).length;
          return (
            <Card key={cl.id} className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">{cl.code.slice(0, 2)}</div>
                <div><p className="text-sm font-semibold text-slate-800">{cl.name}</p><p className="text-xs text-slate-400 font-mono">{cl.code}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-lg font-bold text-slate-700">{ctrs.length}</p><p className="text-xs text-slate-400">Contratos</p></div>
                <div><p className="text-lg font-bold text-slate-700">{cnt}</p><p className="text-xs text-slate-400">Blocos</p></div>
                <div><p className="text-lg font-bold text-emerald-600">{total - used}</p><p className="text-xs text-slate-400">Disponíveis</p></div>
              </div>
              <p className="text-xs text-slate-400 mt-3">{cl.contactEmail}</p>
            </Card>
          );
        })}
      </div>
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

function UsersPage() {
  const { currentUser } = useContext(AppContext);
  const [users, setUsers] = useState<SeedUser[]>([...USERS]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("internal_ops");
  const [newClientId, setNewClientId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    const u: SeedUser = {
      id: `u_${Date.now()}`, name: newName.trim(), email: newEmail.trim(),
      role: newRole, active: true, ...(newRole === "client" && newClientId ? { clientId: newClientId } : {}),
    };
    setUsers([...users, u]); USERS.push(u);
    setNewName(""); setNewEmail(""); setNewRole("internal_ops"); setNewClientId(""); setShowAdd(false);
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
            <div className="flex gap-1"><button onClick={() => handleDelete(r.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Confirmar</button><button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300">Cancelar</button></div>
          ) : (
            <button onClick={() => setConfirmDelete(r.id)} className="text-xs text-red-500 hover:text-red-700 hover:underline">Remover</button>
          )},
        ]} />
      </Card>
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Novo Usuário</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Nome *</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Email *</label><input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@archtechtour.com" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Perfil</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {newRole === "client" && (
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
                  <select value={newClientId} onChange={(e) => setNewClientId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                    <option value="">Selecione...</option>
                    {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={handleAdd} disabled={!newName.trim() || !newEmail.trim()} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40">Criar Usuário</button>
            </div>
          </div>
        </div>
      )}
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

  if (!currentUser) {
    return (
      <AppContext.Provider value={{ currentUser, setCurrentUser, blocks, setBlocks, activities, setActivities }}>
        <LoginPage />
      </AppContext.Provider>
    );
  }

  const isClient = currentUser.role === "client";

  const renderPage = () => {
    switch (page) {
      case "dashboard": return isClient ? <ClientDashboard user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} /> : <InternalDashboard setPage={setPage} />;
      case "blocks": return <BlocksListPage user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "block_detail": return <BlockDetailPage blockId={selectedBlock} user={currentUser} setPage={setPage} />;
      case "contracts": return <ContractsPage user={currentUser} setPage={setPage} setSelectedContract={setSelectedContract} />;
      case "contract_detail": return <ContractDetailPage contractId={selectedContract} user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "clients": return <ClientsPage />;
      case "approvals": return <ApprovalsPage user={currentUser} />;
      case "queue": return <QueuePage user={currentUser} setPage={setPage} setSelectedBlock={setSelectedBlock} />;
      case "activity": return <ActivityPage />;
      case "users": return <UsersPage />;
      default: return <InternalDashboard setPage={setPage} />;
    }
  };

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, blocks, setBlocks, activities, setActivities }}>
      <div className="min-h-screen bg-slate-50">
        <Sidebar page={page} setPage={setPage} user={currentUser} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className={`transition-all duration-300 ${collapsed ? "ml-[64px]" : "ml-[240px]"}`}>
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-6 py-3 flex items-center justify-between">
            <p className="text-sm text-slate-600">{isClient ? getClientName(currentUser.clientId!) : "Painel Interno"}</p>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-slate-100 rounded-lg relative transition-colors">
                <Bell className="w-[18px] h-[18px] text-slate-500" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <div className="h-5 w-px bg-slate-200" />
              <button onClick={() => { setCurrentUser(null); setPage("dashboard"); }} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors">
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </div>
          </header>
          <main className="p-6 max-w-7xl">{renderPage()}</main>
        </div>
      </div>
    </AppContext.Provider>
  );
}

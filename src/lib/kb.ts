/**
 * Base de Conhecimento (KB) da ArchTechTour.
 *
 * Uma tabela (`att-kb`) com dois tipos de registro:
 *  - `base`    — uma Base (Comercial, Marketing, Tech, TI…). Carrega a lista de
 *                quem pode VER (`access`) e quem pode EDITAR (`editors`), ambas
 *                por perfil (grupo) e/ou por usuário. Admin sempre vê e edita.
 *  - `article` — um artigo dentro de uma base: título, seção, corpo em Markdown
 *                (subconjunto renderizado pelo portal), tags e anexos no S3.
 *
 * Anexos ficam em `s3://archtechtour-assets/kb/<baseId>/<articleId>/<ts>_<nome>`.
 * O upload é direto do browser via URL pré-assinada (`/api/kb/upload`); a leitura
 * passa por `/api/kb/file?key=…`, que redireciona para uma URL assinada fresca.
 */

export type KbRole = "admin" | "internal_ops" | "internal_modeling" | "internal_programming" | "client" | "freelancer_bim";

export const KB_ROLE_LABELS: Record<KbRole, string> = {
  admin: "Admin",
  internal_ops: "Operações",
  internal_modeling: "Modelagem",
  internal_programming: "Programação",
  client: "Cliente",
  freelancer_bim: "Terceirizado BIM",
};

/** O que o KB precisa saber sobre quem está logado. */
export interface KbUser {
  id: string;
  name: string;
  email?: string;
  role: KbRole;
  clientId?: string;
}

/** Lista de acesso: perfis inteiros (grupos) e/ou usuários específicos. */
export interface KbAccessList {
  roles: KbRole[];
  userIds: string[];
}

export type KbIcon = "briefcase" | "megaphone" | "cpu" | "server" | "book" | "palette" | "wrench" | "users" | "shield" | "box";
export type KbColor = "emerald" | "sky" | "violet" | "amber" | "rose" | "slate" | "teal" | "orange";

export interface KbBase {
  id: string;
  kind: "base";
  name: string;
  description: string;
  icon: KbIcon;
  color: KbColor;
  order: number;
  /** Quem vê a base (admin sempre vê). */
  access: KbAccessList;
  /** Quem cria/edita artigos e anexos (admin sempre edita). */
  editors: KbAccessList;
  /**
   * Senha da base (opcional). No banco fica só `passwordHash` (scrypt + salt);
   * a API de estado nunca devolve o hash — devolve `locked: true`. Para definir
   * ou trocar, o admin manda `password` no POST; `clearPassword: true` remove.
   * Quem tem acesso digita a senha uma vez por sessão (`POST /api/kb/unlock`).
   */
  locked?: boolean;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface KbAttachment {
  id: string;
  /** Chave no S3 (bucket archtechtour-assets), sempre começa com `kb/`. */
  key: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface KbArticle {
  id: string;
  kind: "article";
  baseId: string;
  title: string;
  /** Agrupador dentro da base (ex.: "Infraestrutura", "Identidade visual"). */
  section: string;
  /** Markdown (subconjunto: títulos, listas, negrito, código, links, tabelas, citações). */
  body: string;
  tags: string[];
  attachments: KbAttachment[];
  order: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type KbRecord = KbBase | KbArticle;

export const isKbBase = (r: KbRecord): r is KbBase => r.kind === "base";
export const isKbArticle = (r: KbRecord): r is KbArticle => r.kind === "article";

const inList = (list: KbAccessList | undefined, user: KbUser) =>
  !!list && (list.roles?.includes(user.role) || list.userIds?.includes(user.id));

/** Admin sempre vê; os demais precisam estar no perfil ou na lista de usuários. */
export function canViewBase(base: KbBase, user: KbUser): boolean {
  if (user.role === "admin") return true;
  return inList(base.access, user);
}

/** Admin sempre edita; editor precisa estar em `editors` (e, por definição, também vê). */
export function canEditBase(base: KbBase, user: KbUser): boolean {
  if (user.role === "admin") return true;
  return inList(base.editors, user);
}

export const emptyAccess = (): KbAccessList => ({ roles: [], userIds: [] });

export const kbId = (prefix: "kb" | "ka") => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Resumo legível da lista de acesso (para a tela de administração). */
export function describeAccess(list: KbAccessList, userName: (id: string) => string): string {
  const parts: string[] = [];
  if (list.roles?.length) parts.push(list.roles.map((r) => KB_ROLE_LABELS[r] ?? r).join(", "));
  if (list.userIds?.length) parts.push(list.userIds.map(userName).join(", "));
  return parts.length ? parts.join(" · ") : "Só admin";
}

/** Extensões aceitas nos anexos. */
export const KB_ALLOWED_EXTENSIONS = [
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".tiff", ".heic",
  ".xlsx", ".xls", ".csv", ".docx", ".doc", ".pptx", ".ppt", ".txt", ".md", ".json",
  ".zip", ".rar", ".7z", ".ai", ".psd", ".eps", ".indd", ".fig", ".sketch",
  ".mp4", ".mov", ".webm", ".mp3", ".wav",
  ".glb", ".gltf", ".fbx", ".obj", ".skp", ".rvt", ".gsm", ".blend", ".max",
];

export const KB_MAX_FILE_MB = 200;

export const fmtKbSize = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

export const kbExt = (name: string) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
};

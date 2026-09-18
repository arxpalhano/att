/**
 * Perfis de acesso do portal (tabela `att-profiles`).
 *
 * Um PERFIL diz quais módulos a pessoa abre e o que pode fazer em cada um
 * (ver / criar / editar / excluir), mais algumas permissões especiais. Cada
 * usuário aponta para um perfil (`profileId`); sem isso vale o perfil padrão do
 * tipo de conta dele (`prof_<role>`).
 *
 * O TIPO DE CONTA (`base`, o antigo "perfil"/role) continua existindo e decide o
 * ESCOPO DOS DADOS, não as permissões: cliente só enxerga a própria marca,
 * terceirizado só as próprias demandas, e é por ele que a Base de Conhecimento
 * libera bases por grupo. Por isso todo perfil nasce de um tipo de conta.
 *
 * Os 6 perfis padrão vivem no código (espelham o comportamento que o portal
 * tinha com as checagens `role === "admin"`). Salvar um perfil com o mesmo id
 * sobrepõe o padrão; o perfil Admin é travado para ninguém se trancar do lado
 * de fora. Se a tabela não carregar, o portal cai nestes padrões.
 *
 * ⚠️ Como o resto do portal, a trava é de interface: as rotas /api/state/* não
 * conferem permissão no servidor.
 */

export type BaseRole = "admin" | "internal_ops" | "internal_modeling" | "internal_programming" | "client" | "freelancer_bim";
export type AccessAction = "view" | "create" | "edit" | "delete";
export type ModulePerm = Partial<Record<AccessAction, boolean>>;
export type SpecialPerm = "statusOverride" | "transition" | "deadlines";

export interface AccessProfile {
  id: string;
  name: string;
  description?: string;
  /** Tipo de conta: escopo dos dados + grupo na Base de Conhecimento. */
  base: BaseRole;
  modules: Record<string, ModulePerm>;
  special: Partial<Record<SpecialPerm, boolean>>;
  /** Perfil padrão do sistema (um por tipo de conta). */
  system?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const BASE_LABELS: Record<BaseRole, string> = {
  admin: "Admin", internal_ops: "Operações", internal_modeling: "Modelagem",
  internal_programming: "Programação", client: "Cliente", freelancer_bim: "Terceirizado BIM",
};
export const BASE_HINTS: Record<BaseRole, string> = {
  admin: "Equipe interna · vê todas as marcas · administra a Base de Conhecimento",
  internal_ops: "Equipe interna · vê todas as marcas · grupo Operações na Base de Conhecimento",
  internal_modeling: "Equipe interna · vê todas as marcas · grupo Modelagem na Base de Conhecimento",
  internal_programming: "Equipe interna · vê todas as marcas · grupo Programação na Base de Conhecimento",
  client: "Marca · só enxerga os dados da própria marca",
  freelancer_bim: "Terceirizado · só enxerga as próprias demandas BIM",
};

export type Audience = "internal" | "client" | "freelancer";
export const audienceOf = (base: BaseRole): Audience => (base === "client" ? "client" : base === "freelancer_bim" ? "freelancer" : "internal");

export interface ModuleDef {
  id: string;
  label: string;
  /** Ações que existem de fato nesse módulo (as demais nem aparecem na matriz). */
  actions: AccessAction[];
  /** Para que tipo de conta o módulo existe. */
  audiences: Audience[];
  hint?: string;
}

/** Módulos na ordem do menu. KB e Atividade ficam de fora — ver `NOT_IN_MATRIX`. */
export const MODULES: ModuleDef[] = [
  { id: "dashboard", label: "Dashboard", actions: ["view"], audiences: ["internal", "client"] },
  { id: "onboarding", label: "Onboarding", actions: ["view"], audiences: ["client"] },
  { id: "tickets", label: "Tickets", actions: ["view", "create", "edit", "delete"], audiences: ["internal"], hint: "Editar = título, bloco, plano, prioridade. Trocar situação e responsável segue liberado para quem vê." },
  { id: "bim", label: "BIM · Terceirizados", actions: ["view", "create", "edit", "delete"], audiences: ["internal"] },
  { id: "bim_minhas", label: "Minhas demandas (BIM)", actions: ["view"], audiences: ["freelancer"] },
  { id: "queue", label: "Fila de Trabalho", actions: ["view"], audiences: ["internal"] },
  { id: "blocks", label: "Blocos", actions: ["view", "create", "edit", "delete"], audiences: ["internal", "client"], hint: "Editar = dados do bloco (nome, SKU, modelador, BIM). Excluir remove também tickets e publicações do bloco." },
  { id: "approvals", label: "Aprovações", actions: ["view"], audiences: ["internal", "client"] },
  { id: "publications", label: "Publicações", actions: ["view", "create", "edit", "delete"], audiences: ["internal", "client"] },
  { id: "finishes", label: "Acabamentos", actions: ["view", "edit"], audiences: ["internal", "client"] },
  { id: "analytics", label: "Analytics", actions: ["view", "edit"], audiences: ["internal", "client"], hint: "Editar = gerenciar os clientes do analytics (dim) e gerar dashboards." },
  { id: "clients", label: "Clientes", actions: ["view", "create", "edit", "delete"], audiences: ["internal"], hint: "Excluir = desativar/reativar a marca (cliente não é apagado)." },
  { id: "contracts", label: "Contratos", actions: ["view", "create", "edit"], audiences: ["internal", "client"] },
  { id: "users", label: "Usuários", actions: ["view", "create", "edit", "delete"], audiences: ["internal"], hint: "Quem vê esta tela enxerga e-mails e senhas de todos." },
  { id: "profiles", label: "Perfis de acesso", actions: ["view", "create", "edit", "delete"], audiences: ["internal"], hint: "Quem edita perfis consegue dar a si mesmo qualquer permissão." },
  { id: "agents", label: "Agentes AI", actions: ["view"], audiences: ["internal"] },
];
export const NOT_IN_MATRIX = "Base de Conhecimento é liberada base a base (na própria tela). Atividade só aparece para o dono do portal.";

export const SPECIALS: Array<{ id: SpecialPerm; label: string; hint: string; audiences: Audience[] }> = [
  { id: "transition", label: "Mover bloco entre etapas", hint: "Botões de transição no detalhe do bloco.", audiences: ["internal", "client"] },
  { id: "statusOverride", label: "Forçar qualquer status no bloco", hint: "Seletor amarelo que pula as transições válidas.", audiences: ["internal"] },
  { id: "deadlines", label: "Alterar prazos", hint: "Entrega prevista e materiais recebidos no bloco; prazo do ticket.", audiences: ["internal"] },
];

export const ACTION_LABELS: Record<AccessAction, string> = { view: "Ver", create: "Criar", edit: "Editar", delete: "Excluir" };

const all = (acts: AccessAction[]): ModulePerm => Object.fromEntries(acts.map((a) => [a, true]));
const view: ModulePerm = { view: true };

/** Módulos que toda a equipe interna abria antes dos perfis existirem. */
const INTERNAL_BASE: Record<string, ModulePerm> = {
  dashboard: view, queue: view, approvals: view,
  tickets: { view: true, create: true, edit: true, delete: true }, // edição liberada para toda a equipe em 2026-09-18
  bim: view,
  blocks: { view: true, create: true },
  publications: view,
  finishes: { view: true, edit: true },
  analytics: { view: true, edit: true },
  clients: view,
  contracts: view,
};

export const defaultProfileId = (base: BaseRole) => `prof_${base}`;

export const DEFAULT_PROFILES: AccessProfile[] = [
  {
    id: defaultProfileId("admin"), name: "Admin", base: "admin", system: true,
    description: "Acesso total. Perfil travado: não pode ser restringido, para ninguém se trancar do lado de fora.",
    modules: Object.fromEntries(MODULES.filter((m) => m.audiences.includes("internal")).map((m) => [m.id, all(m.actions)])),
    special: { transition: true, statusOverride: true, deadlines: true },
  },
  {
    id: defaultProfileId("internal_ops"), name: "Operações", base: "internal_ops", system: true,
    description: "PM / operações: acompanha tudo e gerencia as demandas BIM.",
    modules: { ...INTERNAL_BASE, bim: { view: true, create: true, edit: true, delete: true } },
    special: { transition: true, deadlines: true },
  },
  {
    id: defaultProfileId("internal_modeling"), name: "Modelagem", base: "internal_modeling", system: true,
    description: "Modeladores: pipeline completo, sem administração.",
    modules: { ...INTERNAL_BASE }, special: { transition: true, deadlines: true },
  },
  {
    id: defaultProfileId("internal_programming"), name: "Programação", base: "internal_programming", system: true,
    description: "Desenvolvedores: pipeline completo, sem administração.",
    modules: { ...INTERNAL_BASE }, special: { transition: true, deadlines: true },
  },
  {
    id: defaultProfileId("client"), name: "Cliente", base: "client", system: true,
    description: "Marca em modo validação: só Analytics. Telas extras podem ser liberadas por usuário (Usuários → Editar) ou num perfil próprio.",
    modules: { analytics: view, blocks: { create: true }, finishes: { edit: true } },
    special: { transition: true },
  },
  {
    id: defaultProfileId("freelancer_bim"), name: "Terceirizado BIM", base: "freelancer_bim", system: true,
    description: "Só as próprias demandas de blocos BIM.",
    modules: { bim_minhas: view }, special: {},
  },
];

/** Padrões do código + o que veio do banco (mesmo id sobrepõe; Admin nunca é sobreposto). */
export function mergeProfiles(saved: AccessProfile[]): AccessProfile[] {
  const byId = new Map<string, AccessProfile>(DEFAULT_PROFILES.map((p) => [p.id, p]));
  saved.forEach((p) => {
    if (!p?.id || p.id === defaultProfileId("admin")) return;
    const def = byId.get(p.id);
    byId.set(p.id, def ? { ...p, base: def.base, system: true } : { ...p, system: false });
  });
  return Array.from(byId.values());
}

export interface AccessSubject { role: BaseRole; profileId?: string }

export function profileOf(user: AccessSubject, profiles: AccessProfile[]): AccessProfile {
  const wanted = user.profileId && profiles.find((p) => p.id === user.profileId);
  // Perfil de outro tipo de conta não vale (ex.: usuário virou cliente mas ficou com perfil interno).
  if (wanted && wanted.base === user.role) return wanted;
  return profiles.find((p) => p.id === defaultProfileId(user.role))
    ?? DEFAULT_PROFILES.find((p) => p.base === user.role)
    ?? DEFAULT_PROFILES[DEFAULT_PROFILES.length - 1];
}

export const canDo = (user: AccessSubject, profiles: AccessProfile[], moduleId: string, action: AccessAction): boolean =>
  !!profileOf(user, profiles).modules?.[moduleId]?.[action];

export const hasSpecial = (user: AccessSubject, profiles: AccessProfile[], perm: SpecialPerm): boolean =>
  !!profileOf(user, profiles).special?.[perm];

/** Resumo de uma linha para a coluna "Acesso" da lista de usuários. */
export function summarizeProfile(p: AccessProfile): string {
  const mods = MODULES.filter((m) => p.modules?.[m.id]?.view);
  const canDelete = MODULES.filter((m) => p.modules?.[m.id]?.delete).length;
  return `${mods.length} módulo${mods.length === 1 ? "" : "s"}${canDelete ? ` · exclui em ${canDelete}` : " · não exclui"}`;
}

export const newProfileId = () => `prof_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

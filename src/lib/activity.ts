/**
 * Log de atividades do portal — tipos, rótulos e a descrição automática das
 * mudanças. Este arquivo é compartilhado entre servidor e browser, por isso
 * NÃO importa nada do AWS SDK.
 *
 * Como o log é montado (regra desde set/2026 — o log é o que a gestão usa
 * para cobrar o uso do portal):
 *
 *  1. Toda gravação de estado passa por `/api/state/<tabela>` em modo DELTA
 *     (`{ upsert: [...], delete: [...] }`). O SERVIDOR lê o item anterior,
 *     grava o novo e descreve a diferença aqui (`describeChange`). Não existe
 *     mais log gerado pelo browser para essas tabelas — se gravou, registrou.
 *  2. O que não é tabela de estado (login, logout, tela aberta, upload de
 *     arquivo, agente executado, refresh de analytics) o browser manda para
 *     `/api/activity` na hora, com `keepalive` (sobrevive ao fechar a aba).
 *  3. O servidor carimba `at` (hora do servidor) e quem fez (`x-att-actor`,
 *     mais o e-mail da sessão Microsoft quando existe).
 */

export type ActivityEntity =
  | "blocks" | "tickets" | "clients" | "contracts" | "publications" | "users"
  | "bim-demands" | "finishes" | "kb" | "assets" | "agents" | "analytics" | "session";

export interface ActivityActor {
  id: string;
  name: string;
  role: string;
  email?: string;
  clientId?: string;
}

export interface ActivityRecord {
  id: string;
  /** ISO, hora do servidor. */
  at: string;
  userId: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  /** E-mail da sessão Microsoft (NextAuth) no momento da ação, quando havia. */
  sessionEmail?: string;
  type: string;
  entity: ActivityEntity;
  entityId?: string;
  entityLabel?: string;
  /** Bloco relacionado ("" quando não há) — a tela do bloco filtra por isto. */
  blockId: string;
  clientId?: string;
  desc: string;
  /** Tela aberta (só em `page_view`). */
  page?: string;
  /** "server" = descrito pelo servidor a partir da gravação; "client" = enviado pelo browser. */
  source?: "server" | "client";
}

/** Cabeçalho em que o browser manda quem está logado (JSON de ActivityActor). */
export const ACTOR_HEADER = "x-att-actor";

/** Tipos que são navegação/sessão, não trabalho — ficam fora do feed do dashboard. */
export const NAVIGATION_TYPES = new Set(["page_view", "login", "logout"]);
export const isNavigation = (a: Pick<ActivityRecord, "type">) => NAVIGATION_TYPES.has(a.type);

export const ENTITY_LABELS: Record<ActivityEntity, string> = {
  blocks: "Blocos",
  tickets: "Tickets",
  clients: "Clientes",
  contracts: "Contratos",
  publications: "Publicações",
  users: "Usuários",
  "bim-demands": "BIM · Terceirizados",
  finishes: "Acabamentos",
  kb: "Base de Conhecimento",
  assets: "Arquivos",
  agents: "Agentes AI",
  analytics: "Analytics",
  session: "Acesso e navegação",
};

export const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard", onboarding: "Onboarding", blocks: "Blocos", block_detail: "Detalhe do bloco",
  contracts: "Contratos", contract_detail: "Detalhe do contrato", clients: "Clientes", approvals: "Aprovações",
  queue: "Fila de Trabalho", tickets: "Tickets", publications: "Publicações", analytics: "Analytics",
  activity: "Atividade", users: "Usuários", finishes: "Acabamentos", bim: "BIM · Terceirizados",
  bim_minhas: "Minhas demandas", kb: "Base de Conhecimento", agents: "Agentes AI",
  agent_sherlock_codes: "Agente Sherlock Codes", agent_monk_lighthouse: "Agente Monk Lighthouse",
  agent_yoda_kanban: "Agente Yoda Kanban", agent_harvey_closer: "Agente Harvey Closer",
  agent_argus_watchtower: "Agente Argus Watchtower",
};

// ------------------------------------------------------------
// Rótulos compartilhados com o Portal (fonte única — o Portal importa daqui)
// ------------------------------------------------------------
export const BLOCK_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", awaiting_client_files: "Aguardando Arquivos",
  client_files_under_review: "Arquivos em Revisão", ready_to_start: "Pronto p/ Iniciar",
  in_modeling: "Em Modelagem", in_texturing: "Em Texturização", awaiting_client_material_validation: "Validação Material",
  approved_for_programming: "Aprovado p/ Programação", in_programming: "Em Programação",
  internal_review: "Revisão Interna", awaiting_client_final_validation: "Validação Final",
  approved: "Aprovado", bim_conversion: "Conversão BIM", published: "Publicado", blocked: "Bloqueado",
  on_hold: "Em Espera", archived: "Arquivado",
};
export const TICKET_STATUS_LABELS: Record<string, string> = {
  new: "Novo", in_production: "Em Produção", internal_review: "Revisão Interna", delivered: "Entregue",
};
export const BIM_DEMAND_STATUS_LABELS: Record<string, string> = {
  not_started: "Não iniciada", waiting_info: "Aguardando informação", in_progress: "Em andamento",
  delivered: "Entregue", approved: "Aprovada",
};
export const ROLE_LABELS_PT: Record<string, string> = {
  admin: "Admin", internal_ops: "Operações", internal_modeling: "Modelagem",
  internal_programming: "Programação", client: "Cliente", freelancer_bim: "Terceirizado BIM",
};
const PRIORITY_PT: Record<string, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
const CLIENT_VALIDATION_STATUSES = new Set(["awaiting_client_material_validation", "awaiting_client_final_validation"]);

/** Nomes que o servidor resolve antes de descrever (usuários, clientes, blocos). */
export interface NameResolver {
  user: (id?: string) => string;
  client: (id?: string) => string;
  block: (id?: string) => string;
}
export const NO_NAMES: NameResolver = { user: (id) => id || "—", client: (id) => id || "—", block: (id) => id || "—" };

type Item = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Parte da atividade que a descrição produz; o servidor completa id/at/ator. */
export type ActivityDraft = Pick<ActivityRecord, "type" | "entity" | "desc" | "blockId"> &
  Partial<Pick<ActivityRecord, "entityId" | "entityLabel" | "clientId">>;

// "Vazio" é tudo igual: undefined, null, "", e objeto só com false/vazios (ex.: o
// formulário de bloco manda {skp:false,rvt:false,gsm:false} para um bim ausente).
const blank = (v: unknown): boolean =>
  v === undefined || v === null || v === "" || v === false ||
  (typeof v === "object" && !Array.isArray(v) && Object.values(v as Record<string, unknown>).every(blank));
const same = (a: unknown, b: unknown) => (blank(a) && blank(b)) || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const changedFields = (before: Item, after: Item, labels: Record<string, string>): string[] =>
  Object.keys(labels).filter((k) => !same(before[k], after[k])).map((k) => labels[k]);
const listOf = (fields: string[]) => (fields.length ? ` · alterou: ${fields.join(", ")}` : "");

/**
 * Descreve a mudança de UM item de uma tabela de estado. `before === null` é
 * criação; `after === null` é exclusão. Pode devolver mais de uma atividade
 * (ex.: status mudou E outros campos mudaram).
 */
export function describeChange(entity: ActivityEntity, before: Item | null, after: Item | null, actor: ActivityActor, names: NameResolver = NO_NAMES): ActivityDraft[] {
  const cur = after ?? before;
  if (!cur) return [];
  const base = (d: Partial<ActivityDraft> & { type: string; desc: string }): ActivityDraft => ({
    entity, blockId: "", entityId: cur.id, ...d,
  });

  switch (entity) {
    case "blocks": {
      const label = `${cur.title ?? "(sem título)"}${cur.sku ? ` (${cur.sku})` : ""}`;
      const ctx = { blockId: cur.id as string, clientId: cur.clientId as string | undefined, entityLabel: label };
      if (!before) return [base({ ...ctx, type: "block_created", desc: `Bloco criado: ${label}` })];
      if (!after) return [base({ ...ctx, type: "block_deleted", desc: `Bloco excluído: ${label}` })];
      const out: ActivityDraft[] = [];
      if (before.status !== after.status) {
        const from = BLOCK_STATUS_LABELS[before.status] ?? before.status;
        const to = BLOCK_STATUS_LABELS[after.status] ?? after.status;
        const revBefore = before.clientRevisions ?? 0;
        const revAfter = after.clientRevisions ?? 0;
        if (actor.role === "client" && CLIENT_VALIDATION_STATUSES.has(before.status)) {
          if (revAfter > revBefore) out.push(base({ ...ctx, type: "approval_rejected", desc: `Revisão ${revAfter} solicitada pelo cliente (${from}) → ${to} · ${label}` }));
          else out.push(base({ ...ctx, type: "approval_approved", desc: `${from} aprovada pelo cliente → ${to} · ${label}` }));
        } else {
          out.push(base({ ...ctx, type: "status_changed", desc: `Status: ${from} → ${to} · ${label}${revAfter > revBefore ? ` (revisão ${revAfter} do cliente)` : ""}` }));
        }
      }
      const fields = changedFields(before, after, {
        title: "título", sku: "SKU", csku: "SKU do cliente", desc: "descrição", svc: "plano", pri: "prioridade",
        owner: "responsável", backup: "backup", modeler: "modelador", bim: "arquivos BIM", contractId: "contrato", clientId: "cliente",
      });
      if (fields.length) out.push(base({ ...ctx, type: "block_edited", desc: `Bloco editado: ${label}${listOf(fields)}` }));
      return out;
    }

    case "tickets": {
      const label = cur.title ?? cur.id;
      const ctx = { blockId: (cur.blockId as string) || "", clientId: cur.clientId as string | undefined, entityLabel: label };
      if (!before) return [base({ ...ctx, type: "ticket_created", desc: `Ticket criado: ${label}${cur.assignedTo ? ` · responsável ${names.user(cur.assignedTo)}` : ""}` })];
      if (!after) return [base({ ...ctx, type: "ticket_deleted", desc: `Ticket excluído: ${label}` })];
      const out: ActivityDraft[] = [];
      if (before.status !== after.status) out.push(base({ ...ctx, type: "ticket_status", desc: `Ticket "${label}": ${TICKET_STATUS_LABELS[before.status] ?? before.status} → ${TICKET_STATUS_LABELS[after.status] ?? after.status}` }));
      if (before.assignedTo !== after.assignedTo) out.push(base({ ...ctx, type: "ticket_assigned", desc: after.assignedTo ? `Ticket "${label}" atribuído a ${names.user(after.assignedTo)}` : `Ticket "${label}" ficou sem responsável` }));
      const fields = changedFields(before, after, { title: "título", plan: "plano", slaDate: "prazo", priority: "prioridade", blockId: "bloco", clientId: "cliente" });
      if (fields.length) out.push(base({ ...ctx, type: "ticket_edited", desc: `Ticket editado: ${label}${listOf(fields)}` }));
      return out;
    }

    case "clients": {
      const label = cur.name ?? cur.id;
      const ctx = { clientId: cur.id as string, entityLabel: label };
      if (!before) return [base({ ...ctx, type: "client_created", desc: `Cliente criado: ${label}${cur.code ? ` (${cur.code})` : ""}` })];
      if (!after) return [base({ ...ctx, type: "client_deleted", desc: `Cliente excluído: ${label}` })];
      const out: ActivityDraft[] = [];
      if (!!before.active !== !!after.active) out.push(base({ ...ctx, type: "client_toggled", desc: `Cliente ${after.active ? "ativado" : "desativado"}: ${label}` }));
      const fields = changedFields(before, after, { name: "nome", code: "código", contactEmail: "e-mail de contato" });
      if (fields.length) out.push(base({ ...ctx, type: "client_edited", desc: `Cliente editado: ${label}${listOf(fields)}` }));
      return out;
    }

    case "contracts": {
      const label = `${cur.title ?? cur.id} · ${names.client(cur.clientId)}`;
      const ctx = { clientId: cur.clientId as string | undefined, entityLabel: label };
      if (!before) return [base({ ...ctx, type: "contract_created", desc: `Contrato criado: ${label} (${cur.totalBlocks ?? 0} blocos)` })];
      if (!after) return [base({ ...ctx, type: "contract_deleted", desc: `Contrato excluído: ${label}` })];
      const fields = changedFields(before, after, { title: "título", totalBlocks: "total de blocos", usedBlocks: "blocos usados", startDate: "início", active: "ativo", clientId: "cliente" });
      return fields.length ? [base({ ...ctx, type: "contract_edited", desc: `Contrato editado: ${label}${listOf(fields)}` })] : [];
    }

    case "publications": {
      const label = `${names.block(cur.blockId)} v${cur.v ?? "?"}`;
      const ctx = { blockId: (cur.blockId as string) || "", entityLabel: label };
      if (!before) return [base({ ...ctx, type: "publication_created", desc: `Publicação configurada: ${label} · ${cur.url ?? ""}` })];
      if (!after) return [base({ ...ctx, type: "publication_deleted", desc: `Publicação removida: ${label}` })];
      const fields = changedFields(before, after, { url: "URL", v: "versão", env: "ambiente", blockId: "bloco" });
      return fields.length ? [base({ ...ctx, type: "publication_updated", desc: `Publicação editada: ${label}${listOf(fields)}` })] : [];
    }

    case "users": {
      const label = `${cur.name ?? cur.id} (${ROLE_LABELS_PT[cur.role] ?? cur.role})`;
      const ctx = { entityLabel: label };
      if (!before) return [base({ ...ctx, type: "user_created", desc: `Usuário criado: ${label} · ${cur.email ?? ""}` })];
      if (!after) return [base({ ...ctx, type: "user_deleted", desc: `Usuário excluído: ${label}` })];
      // A senha nunca aparece na descrição — só o fato de ter mudado.
      const fields = changedFields(before, after, { name: "nome", email: "e-mail", role: "perfil", clientId: "cliente", active: "ativo", allowedPages: "telas liberadas", password: "senha" });
      return fields.length ? [base({ ...ctx, type: "user_edited", desc: `Usuário editado: ${label}${listOf(fields)}` })] : [];
    }

    case "bim-demands": {
      const label = `${cur.title ?? cur.id} · ${names.client(cur.clientId)}`;
      const ctx = { clientId: cur.clientId as string | undefined, entityLabel: label };
      const doneCount = (d: Item) => ((d.items as Item[]) || []).reduce((n, i) => n + ((i.done as unknown[]) || []).length, 0);
      if (!before) return [base({ ...ctx, type: "bim_created", desc: `Demanda BIM criada: ${label} · ${cur.productCount ?? 0} produto(s) para ${names.user(cur.freelancerId)}` })];
      if (!after) return [base({ ...ctx, type: "bim_deleted", desc: `Demanda BIM excluída: ${label}` })];
      const out: ActivityDraft[] = [];
      if (before.status !== after.status) out.push(base({ ...ctx, type: "bim_status", desc: `Demanda BIM "${cur.title}": ${BIM_DEMAND_STATUS_LABELS[before.status] ?? before.status} → ${BIM_DEMAND_STATUS_LABELS[after.status] ?? after.status}` }));
      const db = doneCount(before), da = doneCount(after);
      if (db !== da) out.push(base({ ...ctx, type: "bim_files", desc: `Demanda BIM "${cur.title}": arquivos entregues ${db} → ${da}` }));
      const fields = changedFields(before, after, { title: "título", productCount: "qtd. produtos", dueAt: "prazo", requestedAt: "data do pedido", freelancerId: "terceirizado", unitPrice: "valor", notes: "orientações", freelancerNotes: "observações do terceirizado", items: "lista de produtos" });
      const rest = fields.filter((f) => f !== "lista de produtos" || db === da);
      if (rest.length) out.push(base({ ...ctx, type: "bim_edited", desc: `Demanda BIM editada: ${label}${listOf(rest)}` }));
      return out;
    }

    case "finishes": {
      if (cur.kind === "catalog") {
        const groups = (cur.groups as Item[]) || [];
        const opts = groups.reduce((n, g) => n + ((g.options as unknown[]) || []).length, 0);
        const label = `Catálogo de acabamentos · ${names.client(cur.clientId)}`;
        const ctx = { clientId: cur.clientId as string | undefined, entityLabel: label };
        if (!after) return [base({ ...ctx, type: "finishes_deleted", desc: `${label} excluído` })];
        return [base({ ...ctx, type: before ? "finishes_catalog_updated" : "finishes_catalog_created", desc: `${label} ${before ? "atualizado" : "criado"} · ${groups.length} grupo(s), ${opts} opção(ões)` })];
      }
      const label = `Acabamentos do produto ${names.block(cur.blockId)}`;
      const ctx = { blockId: (cur.blockId as string) || "", clientId: cur.clientId as string | undefined, entityLabel: label };
      if (!after) return [base({ ...ctx, type: "finishes_deleted", desc: `${label} excluídos` })];
      return [base({ ...ctx, type: before ? "finishes_block_updated" : "finishes_block_created", desc: `${label} ${before ? "atualizados" : "cadastrados"}` })];
    }

    case "kb": {
      if (cur.kind === "base") {
        const label = `Base "${cur.name ?? cur.id}"`;
        if (!before) return [base({ entityLabel: label, type: "kb_base_created", desc: `${label} criada na Base de Conhecimento` })];
        if (!after) return [base({ entityLabel: label, type: "kb_base_deleted", desc: `${label} excluída da Base de Conhecimento` })];
        const fields = changedFields(before, after, { name: "nome", description: "descrição", access: "quem vê", editors: "quem edita", passwordHash: "senha", icon: "ícone", color: "cor", order: "ordem" });
        return fields.length ? [base({ entityLabel: label, type: "kb_base_edited", desc: `${label} editada${listOf(fields)}` })] : [];
      }
      const label = `Artigo "${cur.title ?? cur.id}"`;
      if (!before) return [base({ entityLabel: label, type: "kb_article_created", desc: `${label} criado na Base de Conhecimento` })];
      if (!after) return [base({ entityLabel: label, type: "kb_article_deleted", desc: `${label} excluído da Base de Conhecimento` })];
      const out: ActivityDraft[] = [];
      const ab = ((before.attachments as Item[]) || []).length, aa = ((after.attachments as Item[]) || []).length;
      if (aa > ab) out.push(base({ entityLabel: label, type: "kb_attachment_added", desc: `Anexo adicionado em ${label} (${aa - ab})` }));
      if (aa < ab) out.push(base({ entityLabel: label, type: "kb_attachment_removed", desc: `Anexo removido de ${label} (${ab - aa})` }));
      const fields = changedFields(before, after, { title: "título", section: "seção", body: "conteúdo", tags: "tags", baseId: "base" });
      if (fields.length) out.push(base({ entityLabel: label, type: "kb_article_edited", desc: `${label} editado${listOf(fields)}` }));
      return out;
    }

    default:
      return [base({ type: before ? (after ? "edited" : "deleted") : "created", desc: `${ENTITY_LABELS[entity] ?? entity}: ${cur.id}` })];
  }
}

/** Rótulo curto por tipo (badge na tela de Atividade). Tipos fora daqui mostram a entidade. */
export const TYPE_LABELS: Record<string, string> = {
  login: "Login", logout: "Saiu", page_view: "Abriu tela",
  block_created: "Bloco criado", block_edited: "Bloco editado", block_deleted: "Bloco excluído",
  status_changed: "Status", approval_approved: "Aprovação", approval_rejected: "Revisão pedida",
  asset_uploaded: "Arquivo enviado", import: "Importação",
  ticket_created: "Ticket criado", ticket_status: "Ticket · status", ticket_assigned: "Ticket · responsável", ticket_edited: "Ticket editado", ticket_deleted: "Ticket excluído",
  client_created: "Cliente criado", client_edited: "Cliente editado", client_toggled: "Cliente ativo/inativo", client_deleted: "Cliente excluído",
  contract_created: "Contrato criado", contract_edited: "Contrato editado", contract_deleted: "Contrato excluído",
  publication_created: "Publicação criada", publication_updated: "Publicação editada", publication_deleted: "Publicação removida",
  user_created: "Usuário criado", user_edited: "Usuário editado", user_deleted: "Usuário excluído",
  bim_created: "BIM · demanda criada", bim_status: "BIM · status", bim_files: "BIM · arquivos", bim_edited: "BIM · editada", bim_deleted: "BIM · excluída",
  finishes_catalog_created: "Catálogo criado", finishes_catalog_updated: "Catálogo atualizado", finishes_block_created: "Acabamentos cadastrados", finishes_block_updated: "Acabamentos atualizados", finishes_deleted: "Acabamentos excluídos",
  kb_base_created: "KB · base criada", kb_base_edited: "KB · base editada", kb_base_deleted: "KB · base excluída",
  kb_article_created: "KB · artigo criado", kb_article_edited: "KB · artigo editado", kb_article_deleted: "KB · artigo excluído",
  kb_attachment_added: "KB · anexo", kb_attachment_removed: "KB · anexo removido",
  agent_run: "Agente executado", agent_config: "Agente configurado", analytics_refresh: "Analytics atualizado",
};

export const PRIORITY_LABELS_PT = PRIORITY_PT;

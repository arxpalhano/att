/**
 * Lado do servidor do log de atividades + fábrica das rotas de estado.
 *
 * Toda rota `/api/state/<tabela>` (menos a KB, que tem regra de senha) é
 * gerada por `stateRoute()`. O contrato:
 *
 *   GET                      → { items }
 *   POST { upsert, delete }  → aplica o delta item a item, descreve cada
 *                              mudança (lib/activity.ts) e grava no
 *                              att-activities. Devolve { ok, activities }.
 *   POST { id, ... }         → mesmo que upsert de um item.
 *   POST [ ... ]             → replaceAll (só seed/manutenção). Não gera log.
 *   DELETE ?id=              → exclui um item (com log).
 *
 * Quem fez vem do cabeçalho `x-att-actor` (JSON de ActivityActor) que o
 * browser manda em todo fetch de gravação; o e-mail da sessão Microsoft, quando
 * há, vai junto como `sessionEmail`.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { DynamoDBDocumentClient, ScanCommand, ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { authOptions } from "./auth-options";
import { bootstrapAmplifyCredentials } from "./amplify-credentials";
import { scanAll, getItem, putItem, deleteItem, replaceAll, TABLES } from "./dynamo";
import {
  ACTOR_HEADER, ActivityActor, ActivityDraft, ActivityEntity, ActivityRecord, NameResolver, NO_NAMES,
  describeChange, ENTITY_LABELS,
} from "./activity";

bootstrapAmplifyCredentials();

const ANON: ActivityActor = { id: "anon", name: "(sem usuário)", role: "unknown" };

/** Quem está agindo: cabeçalho do browser + e-mail da sessão Microsoft (se houver). */
export async function readActor(req: NextRequest): Promise<{ actor: ActivityActor; sessionEmail?: string }> {
  let actor: ActivityActor = ANON;
  const raw = req.headers.get(ACTOR_HEADER);
  if (raw) {
    try {
      // Vem codificado (encodeURIComponent) — acento em cabeçalho HTTP derruba o
      // request com 400 antes de chegar aqui. Aceita também o JSON cru (versão antiga).
      let txt = raw;
      try { txt = decodeURIComponent(raw); } catch { /* já era JSON cru */ }
      const p = JSON.parse(txt);
      if (p && typeof p.id === "string") actor = { id: p.id, name: String(p.name ?? p.id), role: String(p.role ?? "unknown"), email: p.email, clientId: p.clientId };
    } catch { /* cabeçalho inválido: fica anônimo */ }
  }
  let sessionEmail: string | undefined;
  try {
    const s = await getServerSession(authOptions);
    sessionEmail = s?.user?.email ?? undefined;
  } catch { /* sem sessão Microsoft (login por senha) */ }
  return { actor, sessionEmail };
}

let seq = 0;
export const newActivityId = () => `al_${Date.now()}_${(seq++ % 1000).toString().padStart(3, "0")}_${Math.random().toString(36).slice(2, 6)}`;

/** Completa os rascunhos com id/hora/ator e grava. Devolve os registros gravados. */
export async function writeActivities(drafts: ActivityDraft[], actor: ActivityActor, sessionEmail: string | undefined, source: "server" | "client"): Promise<ActivityRecord[]> {
  if (!drafts.length) return [];
  const at = new Date().toISOString();
  const records: ActivityRecord[] = drafts.map((d) => ({
    id: newActivityId(), at, source,
    userId: actor.id, userName: actor.name, userRole: actor.role, userEmail: actor.email, sessionEmail,
    type: d.type, entity: d.entity, entityId: d.entityId, entityLabel: d.entityLabel,
    blockId: d.blockId ?? "", clientId: d.clientId, desc: d.desc,
  }));
  await replaceAll(TABLES.ACTIVITIES, records); // batch put (ids novos: nunca sobrescreve)
  return records;
}

/** Carrega os nomes que a descrição precisa (só as tabelas que a entidade usa). */
async function loadNames(entity: ActivityEntity): Promise<NameResolver> {
  const needUsers = entity === "tickets" || entity === "bim-demands";
  const needClients = entity === "contracts" || entity === "bim-demands" || entity === "finishes";
  const needBlocks = entity === "publications" || entity === "finishes";
  if (!needUsers && !needClients && !needBlocks) return NO_NAMES;
  type Named = { id: string; name?: string; title?: string; sku?: string };
  const [users, clients, blocks] = await Promise.all([
    needUsers ? scanAll<Named>(TABLES.USERS) : Promise.resolve([] as Named[]),
    needClients ? scanAll<Named>(TABLES.CLIENTS) : Promise.resolve([] as Named[]),
    needBlocks ? scanAll<Named>(TABLES.BLOCKS) : Promise.resolve([] as Named[]),
  ]);
  const byId = (list: Named[]) => new Map(list.map((x) => [x.id, x]));
  const u = byId(users), c = byId(clients), b = byId(blocks);
  return {
    user: (id) => (id ? u.get(id)?.name ?? id : "—"),
    client: (id) => (id ? c.get(id)?.name ?? id : "—"),
    block: (id) => { if (!id) return "—"; const x = b.get(id); return x ? `${x.title ?? id}${x.sku ? ` (${x.sku})` : ""}` : id; },
  };
}

export interface StateDelta { upsert?: Array<Record<string, unknown> & { id: string }>; delete?: string[] }

/**
 * Aplica um delta na tabela e registra cada mudança. Criações em massa
 * (importação) viram um único registro-resumo para não afogar o log.
 */
export async function applyDelta(table: string, entity: ActivityEntity, delta: StateDelta, actor: ActivityActor, sessionEmail?: string): Promise<{ activities: ActivityRecord[]; upserted: number; deleted: number }> {
  const upsert = (delta.upsert ?? []).filter((i) => i && typeof i.id === "string");
  const del = (delta.delete ?? []).filter((id) => typeof id === "string");
  if (!upsert.length && !del.length) return { activities: [], upserted: 0, deleted: 0 };

  const names = await loadNames(entity);
  const drafts: ActivityDraft[] = [];
  let created = 0;
  const createdDrafts: ActivityDraft[] = [];
  for (const item of upsert) {
    const before = await getItem<Record<string, unknown>>(table, item.id);
    await putItem(table, item);
    const d = describeChange(entity, before, item, actor, names);
    if (!before) { created++; createdDrafts.push(...d); } else drafts.push(...d);
  }
  if (created > 10) {
    drafts.push({ type: "import", entity, blockId: "", desc: `Importação: ${created} registro(s) criado(s) em ${ENTITY_LABELS[entity]}` });
  } else drafts.push(...createdDrafts);
  for (const id of del) {
    const before = await getItem<Record<string, unknown>>(table, id);
    if (!before) continue;
    await deleteItem(table, id);
    drafts.push(...describeChange(entity, before, null, actor, names));
  }
  const activities = await writeActivities(drafts, actor, sessionEmail, "server");
  return { activities, upserted: upsert.length, deleted: del.length };
}

/** Lista atividades dos últimos N dias (0 = tudo), mais recentes primeiro. */
export async function listActivities(opts: { days?: number; userId?: string; entity?: string; clientId?: string } = {}): Promise<ActivityRecord[]> {
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.APP_AWS_REGION || "us-east-1" }));
  const names: string[] = [];
  const values: Record<string, unknown> = {};
  const attrNames: Record<string, string> = {};
  if (opts.days && opts.days > 0) {
    const cutoff = new Date(Date.now() - opts.days * 86400000).toISOString();
    names.push("#at >= :cutoff"); values[":cutoff"] = cutoff; attrNames["#at"] = "at";
  }
  if (opts.userId) { names.push("userId = :uid"); values[":uid"] = opts.userId; }
  if (opts.entity) { names.push("entity = :ent"); values[":ent"] = opts.entity; }
  if (opts.clientId) { names.push("clientId = :cid"); values[":cid"] = opts.clientId; }
  const items: ActivityRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res: ScanCommandOutput = await doc.send(new ScanCommand({
      TableName: TABLES.ACTIVITIES,
      ExclusiveStartKey: lastKey,
      ...(names.length ? { FilterExpression: names.join(" AND "), ExpressionAttributeValues: values } : {}),
      ...(Object.keys(attrNames).length ? { ExpressionAttributeNames: attrNames } : {}),
    }));
    items.push(...((res.Items as ActivityRecord[]) || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const fail = (e: unknown) => json({ error: (e as Error).message }, 500);

/** Gera GET/POST/DELETE de uma rota de estado com log automático. */
export function stateRoute(table: string, entity: ActivityEntity) {
  async function GET() {
    try { return json({ items: await scanAll(table) }); } catch (e) { return fail(e); }
  }
  async function POST(req: NextRequest) {
    try {
      const body = await req.json();
      if (Array.isArray(body)) {
        await replaceAll(table, body);
        return json({ ok: true, count: body.length });
      }
      const { actor, sessionEmail } = await readActor(req);
      const delta: StateDelta = body && (Array.isArray(body.upsert) || Array.isArray(body.delete))
        ? { upsert: body.upsert, delete: body.delete }
        : { upsert: [body] };
      const r = await applyDelta(table, entity, delta, actor, sessionEmail);
      return json({ ok: true, ...r });
    } catch (e) { return fail(e); }
  }
  async function DELETE(req: NextRequest) {
    try {
      const id = req.nextUrl.searchParams.get("id");
      if (!id) return json({ error: "id required" }, 400);
      const { actor, sessionEmail } = await readActor(req);
      const r = await applyDelta(table, entity, { delete: [id] }, actor, sessionEmail);
      return json({ ok: true, ...r });
    } catch (e) { return fail(e); }
  }
  return { GET, POST, DELETE };
}

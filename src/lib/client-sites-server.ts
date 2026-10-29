/**
 * Verificação automática "No site do cliente" (ver src/lib/client-sites.ts).
 * Cruza produto × domínio de origem do Athena com as publicações e os sites
 * cadastrados de cada marca, e grava o relatório em att-agent-routines.
 */
import { runAthenaQuery } from "./athena";
import { BOT_FILTER } from "./analytics-builder";
import { getItem, putItem, scanAll, TABLES } from "./dynamo";
import {
  ClientSiteHit, ClientSiteReport, CLIENT_SITES_REPORT_ID,
  hostMatches, isIgnoredHost, matchProduct, pubFolderKey, siteHost,
} from "./client-sites";

const DB = process.env.ATHENA_DB || "customizador_events";
const DAYS = 365;

interface Pub { id: string; blockId: string; url: string }
interface Block { id: string; clientId: string }
interface Client { id: string; sites?: string[]; internal?: boolean }

export async function readClientSitesReport(): Promise<ClientSiteReport | null> {
  return getItem<ClientSiteReport>(TABLES.AGENT_ROUTINES, CLIENT_SITES_REPORT_ID);
}

export async function runClientSitesCheck(by: string): Promise<ClientSiteReport> {
  const t0 = Date.now();
  const desde = new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10);
  const [pubs, blocks, clients, rows] = await Promise.all([
    scanAll<Pub>(TABLES.PUBLICATIONS),
    scanAll<Block>(TABLES.BLOCKS),
    scanAll<Client>(TABLES.CLIENTS),
    runAthenaQuery(`
      SELECT produto,
             lower(regexp_extract(referrer, 'https?://([^/:?#]+)', 1)) AS host,
             COUNT(DISTINCT session_id) AS sessoes,
             MIN(data_evento) AS primeiro,
             MAX(data_evento) AS ultimo
      FROM ${DB}.vw_eventos_base_com_cliente
      WHERE evento = 'session_start'
        AND data_evento >= '${desde}'
        AND referrer IS NOT NULL AND referrer <> ''${BOT_FILTER}
      GROUP BY 1, 2
    `),
  ]);

  const clientOf = new Map(blocks.map((b) => [b.id, b.clientId]));
  // Candidatos por marca: { key = pasta do customizador, pub }
  const byClient = new Map<string, { key: string; pub: Pub }[]>();
  const all: { key: string; pub: Pub; clientId: string }[] = [];
  for (const p of pubs) {
    const clientId = clientOf.get(p.blockId);
    const key = pubFolderKey(p.url);
    if (!clientId || !key) continue;
    if (!byClient.has(clientId)) byClient.set(clientId, []);
    byClient.get(clientId)!.push({ key, pub: p });
    all.push({ key, pub: p, clientId });
  }
  const sitesOf = new Map(clients.filter((c) => !c.internal).map((c) => [c.id, c.sites ?? []]));

  const hits: Record<string, ClientSiteHit> = {};
  const unknownHosts: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const host = siteHost(r.host || "");
    if (isIgnoredHost(host)) continue;
    const sessions = Number(r.sessoes) || 0;
    const owner = Array.from(sitesOf.entries()).find(([, sites]) => hostMatches(host, sites))?.[0];
    if (owner) {
      for (const c of matchProduct(r.produto || "", byClient.get(owner) ?? [])) {
        const cur = hits[c.pub.id];
        if (!cur) {
          hits[c.pub.id] = { pubId: c.pub.id, blockId: c.pub.blockId, clientId: owner, host, firstSeen: r.primeiro, lastSeen: r.ultimo, sessions };
        } else {
          if (sessions > cur.sessions) cur.host = host;
          cur.sessions += sessions;
          if (r.primeiro < cur.firstSeen) cur.firstSeen = r.primeiro;
          if (r.ultimo > cur.lastSeen) cur.lastSeen = r.ultimo;
        }
      }
      continue;
    }
    // Domínio não cadastrado: a quem pertencem os produtos que abriram lá?
    const owners = new Set(matchProduct(r.produto || "", all).map((c) => c.clientId));
    owners.forEach((cid) => {
      if (!sitesOf.has(cid)) return;
      unknownHosts[cid] = unknownHosts[cid] ?? {};
      unknownHosts[cid][host] = (unknownHosts[cid][host] ?? 0) + sessions;
    });
  }

  const report: ClientSiteReport = {
    id: CLIENT_SITES_REPORT_ID,
    checkedAt: new Date().toISOString(),
    by,
    days: DAYS,
    hits,
    unknownHosts,
    ms: Date.now() - t0,
  };
  await putItem(TABLES.AGENT_ROUTINES, report);
  return report;
}

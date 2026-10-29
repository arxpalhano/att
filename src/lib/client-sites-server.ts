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
  ClientPagesStore, CLIENT_PAGES_ID, CLIENT_PAGES_RETRY_DAYS,
} from "./client-sites";

const DB = process.env.ATHENA_DB || "customizador_events";
const DAYS = 365;

interface Pub { id: string; blockId: string; url: string; clientSite?: { url?: string } }
interface Block { id: string; clientId: string }
interface Client { id: string; sites?: string[]; internal?: boolean }
interface SitemapCache { id: string; fetchedAt: string; urls: string[] }

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

// ── Página do produto no site do cliente ──────────────────────────────────────
const UA = "Mozilla/5.0 (compatible; ArchTechTour-portal/1.0; +https://app.archtechtour.com)";
async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctl.signal, redirect: "follow", cache: "no-store" });
    if (!r.ok) return "";
    const text = await r.text();
    return text.length > 3_000_000 ? text.slice(0, 3_000_000) : text;
  } catch { return ""; } finally { clearTimeout(t); }
}

/** URLs de páginas do sitemap do domínio (segue sitemap index; cache de 3 dias no DynamoDB). */
async function sitemapUrls(domain: string): Promise<string[]> {
  const id = `client-sites#sitemap#${domain}`;
  const cached = await getItem<SitemapCache>(TABLES.AGENT_ROUTINES, id).catch(() => null);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < 3 * 86400_000) return cached.urls;
  const queue: string[] = [];
  for (const base of [`https://www.${domain}`, `https://${domain}`]) {
    const robots = await fetchText(`${base}/robots.txt`, 6000);
    queue.push(...Array.from(robots.matchAll(/^sitemap:\s*(\S+)/gim)).map((m) => m[1]));
    queue.push(`${base}/sitemap.xml`, `${base}/sitemap_index.xml`);
    if (robots) break; // o domínio respondeu: não precisa tentar a outra variação
  }
  // Em ondas paralelas (sitemap index → filhos): sequencial estourava o limite da função.
  const seen = new Set<string>(); const out = new Set<string>();
  let wave = Array.from(new Set(queue));
  for (let depth = 0; depth < 3 && wave.length && seen.size < 80; depth++) {
    wave.forEach((u) => seen.add(u));
    const xmls = await Promise.all(wave.slice(0, 40).map((u) => fetchText(u, 5000)));
    const next: string[] = [];
    for (const xml of xmls) {
      for (const m of Array.from(xml.matchAll(/<loc>\s*([^<\s]+)/g))) {
        const loc = m[1].replace(/&amp;/g, "&");
        if (/sitemap[^/]*\.xml/i.test(loc)) { if (!seen.has(loc)) next.push(loc); } else out.add(loc);
      }
    }
    wave = Array.from(new Set(next));
  }
  const urls = Array.from(out).slice(0, 4000);
  await putItem(TABLES.AGENT_ROUTINES, { id, fetchedAt: new Date().toISOString(), urls } as SitemapCache).catch(() => undefined);
  return urls;
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const GENERIC = new Set(["de", "da", "do", "das", "dos", "com", "e", "the", "cadeira", "mesa", "poltrona", "banco", "banqueta", "sofa", "luminaria", "puff", "apoio", "centro", "lateral", "versao", "index"]);

export async function readClientPages(): Promise<ClientPagesStore | null> {
  return getItem<ClientPagesStore>(TABLES.AGENT_ROUTINES, CLIENT_PAGES_ID);
}

/**
 * Procura a página de um lote de publicações no ar nos sites das marcas, dentro de um
 * orçamento de tempo (a função do Amplify não pode rodar minutos). A tela chama de novo
 * enquanto `remaining > 0`. Prioriza quem nunca foi procurado.
 */
export async function runClientPagesBatch(budgetMs = 12000): Promise<{ done: number; found: number; remaining: number }> {
  const t0 = Date.now();
  const [report, store0, pubs, blocks, clients] = await Promise.all([
    readClientSitesReport(), readClientPages(),
    scanAll<Pub>(TABLES.PUBLICATIONS), scanAll<Block>(TABLES.BLOCKS), scanAll<Client>(TABLES.CLIENTS),
  ]);
  const store: ClientPagesStore = store0 ?? { id: CLIENT_PAGES_ID, updatedAt: "", pages: {} };
  const clientOf = new Map(blocks.map((b) => [b.id, b.clientId]));
  const sitesOf = new Map(clients.map((c) => [c.id, c.sites ?? []]));
  const retryMs = CLIENT_PAGES_RETRY_DAYS * 86400_000;
  // No ar no site do cliente (analytics ou marcado à mão sem link) e com site cadastrado.
  const todo = pubs
    .filter((p) => (report?.hits[p.id] || (p.clientSite && !p.clientSite.url)))
    .map((p) => ({ pub: p, clientId: report?.hits[p.id]?.clientId ?? clientOf.get(p.blockId) ?? "" }))
    .filter(({ clientId }) => (sitesOf.get(clientId) ?? []).length > 0)
    .filter(({ pub }) => { const e = store.pages[pub.id]; return !e || (!e.url && Date.now() - Date.parse(e.checkedAt) > retryMs); })
    // Nunca procurados primeiro; agrupados por marca para um lote ler poucos sitemaps.
    .sort((a, b) => Number(!!store.pages[a.pub.id]) - Number(!!store.pages[b.pub.id]) || a.clientId.localeCompare(b.clientId));

  const sitemapByClient = new Map<string, Promise<string[]>>();
  const urlsFor = (clientId: string) => {
    if (!sitemapByClient.has(clientId)) {
      sitemapByClient.set(clientId, Promise.all((sitesOf.get(clientId) ?? []).slice(0, 3).map((d) => sitemapUrls(siteHost(d)))).then((l) => l.flat()));
    }
    return sitemapByClient.get(clientId)!;
  };

  let done = 0, found = 0, i = 0;
  const worker = async () => {
    while (i < todo.length && Date.now() - t0 < budgetMs) {
      const { pub, clientId } = todo[i++];
      const m = pub.url.match(/\/([^/]+)\/index\.html?/i);
      const folder = m ? m[1] : "";
      if (!folder) continue;
      const tokens = fold(folder).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !GENERIC.has(t));
      const words = tokens.length ? tokens : [fold(folder)];
      const urls = await urlsFor(clientId);
      const cands = urls.filter((u) => { const f = fold(u); return words.every((w) => f.includes(w)); }).slice(0, 6);
      const needle = new RegExp(`/${folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/index\\.html`, "i");
      let page: string | undefined;
      // As candidatas em paralelo, com prazo curto: o Amplify corta a resposta em ~28 s.
      const left = budgetMs + 5000 - (Date.now() - t0);
      if (left < 2000) break;
      const htmls = await Promise.all(cands.map((c) => fetchText(c, Math.min(6000, left))));
      page = cands.find((_, k) => needle.test(htmls[k]));
      if (!page && cands.length && htmls.every((h) => !h)) continue; // site não respondeu: tenta no próximo lote
      store.pages[pub.id] = { clientId, url: page, checkedAt: new Date().toISOString(), tried: cands.length };
      done++; if (page) found++;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  store.updatedAt = new Date().toISOString();
  await putItem(TABLES.AGENT_ROUTINES, store);
  return { done, found, remaining: Math.max(0, todo.length - done) };
}

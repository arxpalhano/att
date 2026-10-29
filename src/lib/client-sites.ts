/**
 * "No site do cliente" — o customizador já está no ar no site da marca?
 *
 * Duas fontes, nesta ordem de confiança:
 *  1. Marcação manual na publicação (`SeedPub.clientSite`), feita pela equipe.
 *  2. Detecção automática pelo analytics: o Athena registra, em cada `session_start`,
 *     o produto aberto e o `referrer` (o domínio da página onde o iframe está).
 *     Se o produto X abriu num domínio cadastrado em `SeedClient.sites` daquela
 *     marca, ele está no site dela. O relatório fica em att-agent-routines
 *     (id `client-sites#report`), separado das publicações para que editar uma
 *     publicação nunca apague o que a verificação achou.
 *
 * Limite honesto: "não detectado" NÃO prova que não está no site — pode estar
 * lá sem ninguém ter aberto ainda, ou a marca não tem domínio cadastrado.
 *
 * Este arquivo não importa nada do servidor (usado também pela tela).
 */

export interface ClientSiteHit {
  pubId: string;
  blockId: string;
  clientId: string;
  /** Domínio onde apareceu (o de mais sessões). */
  host: string;
  firstSeen: string; // YYYY-MM-DD
  lastSeen: string;
  sessions: number;
}

export interface ClientSiteReport {
  id: string;
  checkedAt: string;
  by: string;
  /** Janela consultada no Athena (dias). */
  days: number;
  /** Publicações vistas num site cadastrado da marca, por id da publicação. */
  hits: Record<string, ClientSiteHit>;
  /**
   * Domínios de terceiros onde produtos de uma marca apareceram mas que NÃO estão
   * cadastrados nela — sugestão para completar o cadastro. clientId → host → sessões.
   */
  unknownHosts: Record<string, Record<string, number>>;
  ms: number;
}

export const CLIENT_SITES_REPORT_ID = "client-sites#report";
/** Verificação automática roda de novo quando o relatório tem mais que isso. */
export const CLIENT_SITES_MAX_AGE_H = 20;

/** "https://www.Ricco.com.br/loja?x" → "ricco.com.br" */
export function siteHost(input: string): string {
  let s = (input || "").trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "");
  return s.replace(/^www\./, "");
}

/** O domínio do evento pertence a algum dos sites cadastrados (aceita subdomínios: en.jaderalmeida.com). */
export function hostMatches(host: string, sites: string[] | undefined): boolean {
  const h = siteHost(host);
  if (!h || !sites?.length) return false;
  return sites.some((s) => { const d = siteHost(s); return !!d && (h === d || h.endsWith(`.${d}`)); });
}

export const normKey = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Pasta do customizador na URL publicada: …/ver-15/sofa-baixo/index.html → "sofabaixo". */
export function pubFolderKey(url: string): string {
  const m = (url || "").match(/\/([^/]+)\/index\.html?(?:[?#].*)?$/i) || (url || "").match(/\/([^/]+)\/?(?:[?#].*)?$/);
  return m ? normKey(m[1]) : "";
}

/**
 * O nome do produto no analytics vem com prefixo da marca ("jader-almeida-cadeira-milla",
 * "EstudioBola-Yona"); a pasta publicada é só o produto ("cadeira-milla"). Casa quem o
 * nome do evento TERMINA com a chave da pasta — e, havendo várias, fica com a mais longa
 * ("sofabaixocomchaise" ganha de "chaise").
 */
export function matchProduct<T extends { key: string }>(produto: string, candidates: T[]): T[] {
  const p = normKey(produto);
  const ok = candidates.filter((c) => c.key.length >= 4 && p.endsWith(c.key));
  if (!ok.length) return [];
  const longest = Math.max(...ok.map((c) => c.key.length));
  return ok.filter((c) => c.key.length === longest);
}

/** Domínios que nunca são "site do cliente": nossos, testes locais, buscadores e redes. */
export function isIgnoredHost(host: string): boolean {
  const h = siteHost(host);
  if (!h || !h.includes(".") || /[<>\s]/.test(h)) return true;
  if (h === "localhost" || /^\d+(\.\d+){3}$/.test(h)) return true;
  return /(^|\.)archtechtour\.com$|google\.|facebook\.com$|instagram\.com$|baidu\.com$|bing\.com$|chatgpt\.com$|openai\.com$|seleniumbase\.io$|gather\.town$|admin\.shopify\.com$|shopifypreview\.com$|filesusr\.com$|linkedin\.com$|whatsapp\.com$|t\.co$/.test(h);
}

export interface ClientSiteStatus {
  live: boolean;
  source?: "manual" | "auto";
  host?: string;
  since?: string;
  lastSeen?: string;
  sessions?: number;
  by?: string;
  url?: string;
}

/** Situação de uma publicação: marcação manual primeiro, depois o analytics. */
export function pubClientSite(
  pub: { id: string; clientSite?: { at: string; by: string; url?: string } },
  report: ClientSiteReport | null,
): ClientSiteStatus {
  if (pub.clientSite) return { live: true, source: "manual", since: pub.clientSite.at.slice(0, 10), by: pub.clientSite.by, url: pub.clientSite.url, host: pub.clientSite.url ? siteHost(pub.clientSite.url) : undefined };
  const hit = report?.hits[pub.id];
  if (hit) return { live: true, source: "auto", host: hit.host, since: hit.firstSeen, lastSeen: hit.lastSeen, sessions: hit.sessions };
  return { live: false };
}

/**
 * Importação de links de customizadores a partir de um TXT (um link por linha).
 *
 * O programador termina um lote e fica com a lista de URLs do explorar. Em vez
 * de abrir produto por produto em Publicações, ele cola/sobe o TXT e o portal
 * descobre, para cada link, a MARCA e o BLOCO — e mostra uma prévia para conferir
 * antes de gravar.
 *
 * Formatos de URL que existem em produção:
 *   https://explorar.archtechtour.com/<alias>/ver-<N>/<produto>/index.html
 *   https://explorar.archtechtour.com/jader-ver-20/<produto>/index.html   (versão no alias)
 *
 * O alias da URL NÃO é o `code` do cliente em várias marcas (estudio-bola ×
 * estudiobola, minnimal × minimal, rs × rsdesign, cadeiras-rosa2…). Por isso a
 * marca é resolvida, nesta ordem, por: alias já usado em publicações existentes
 * (aprendido) → code igual → code "parecido" (sem hífen/dígitos).
 *
 * O bloco é resolvido por: mesmo produto já publicado (só mudou a versão) →
 * slug do título idêntico → slug do SKU → semelhança de palavras (precisa conferir).
 */

export interface LinkBlock { id: string; clientId: string; n?: number; title: string; sku?: string; csku?: string; status?: string }
export interface LinkClient { id: string; name: string; code?: string }
export interface LinkPub { id: string; blockId: string; url: string; v: number }

export type MatchHow = "same-product" | "title" | "sku" | "similar" | "none";

export interface ParsedLink {
  line: number;
  raw: string;
  url: string;          // normalizada (https, sem espaços)
  alias: string;
  version: number;      // 0 quando a URL não traz versão
  slug: string;         // pasta do produto
}

export interface LinkMatch extends ParsedLink {
  clientId: string | null;
  blockId: string | null;
  how: MatchHow;
  score: number;                 // 0–1 (1 = certeza)
  /** Publicação que este bloco já tem (vira atualização em vez de criação). */
  existingPubId: string | null;
  existingUrl: string | null;
  /** Outros blocos parecidos, para o seletor da prévia. */
  candidates: Array<{ blockId: string; score: number }>;
  problem?: string;
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const slugify = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const lettersOnly = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z]/g, "");

/** Palavras úteis de um slug/título (números e unidades soltas atrapalham mais do que ajudam). */
function tokens(s: string): string[] {
  return slugify(s).split("-").filter((t) => t.length > 1 && !/^\d+$/.test(t) && !["de", "da", "do", "com", "para", "em", "x", "cm", "mm"].includes(t));
}
/** Dice entre conjuntos de palavras — tolera ordem diferente e palavras a mais no título. */
function similarity(a: string, b: string): number {
  const A = new Set(tokens(a)); const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach((t) => { if (B.has(t)) inter++; });
  // Cobertura do lado menor pesa mais: "puff-austin" contra "Puff Austin Up 0,89 x 0,89…" é o mesmo produto.
  const dice = (2 * inter) / (A.size + B.size);
  const cover = inter / Math.min(A.size, B.size);
  return Math.round((0.5 * dice + 0.5 * cover) * 100) / 100;
}

export function parseLinks(text: string): { links: ParsedLink[]; ignored: Array<{ line: number; raw: string; why: string }> } {
  const links: ParsedLink[] = []; const ignored: Array<{ line: number; raw: string; why: string }> = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const raw = rawLine.trim();
    if (!raw) return;
    const m = /(https?:\/\/[^\s"'<>]+)/i.exec(raw);
    if (!m) { ignored.push({ line: i + 1, raw, why: "linha sem link" }); return; }
    let u: URL;
    try { u = new URL(m[1]); } catch { ignored.push({ line: i + 1, raw, why: "link inválido" }); return; }
    if (!/explorar\.archtechtour\.com$/i.test(u.hostname)) { ignored.push({ line: i + 1, raw, why: "não é um link do explorar.archtechtour.com" }); return; }
    const segs = u.pathname.split("/").filter(Boolean).filter((s) => !/^index\.html?$/i.test(s));
    if (segs.length < 2) { ignored.push({ line: i + 1, raw, why: "link sem pasta de produto" }); return; }
    let alias = decodeURIComponent(segs[0]); let version = 0; let slug = "";
    const verSeg = /^ver-(\d+)$/i.exec(segs[1] || "");
    if (verSeg) { version = Number(verSeg[1]); slug = decodeURIComponent(segs[2] || ""); }
    else { slug = decodeURIComponent(segs[1]); const inAlias = /-ver-(\d+)$/i.exec(alias); if (inAlias) version = Number(inAlias[1]); }
    if (!slug) { ignored.push({ line: i + 1, raw, why: "link sem pasta de produto" }); return; }
    const url = `https://${u.hostname.toLowerCase()}${u.pathname}`;
    if (seen.has(url)) { ignored.push({ line: i + 1, raw, why: "link repetido no arquivo" }); return; }
    seen.add(url);
    links.push({ line: i + 1, raw, url, alias: alias.toLowerCase(), version, slug });
  });
  return { links, ignored };
}

/** alias da URL (sem "-ver-N") → cliente, aprendido das publicações que já existem. */
function learnAliases(pubs: LinkPub[], blocks: Map<string, LinkBlock>): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  pubs.forEach((p) => {
    const parsed = parseLinks(p.url).links[0]; const b = blocks.get(p.blockId);
    if (!parsed || !b) return;
    const key = parsed.alias.replace(/-ver-\d+$/, "");
    const v = votes.get(key) ?? new Map<string, number>(); v.set(b.clientId, (v.get(b.clientId) ?? 0) + 1); votes.set(key, v);
  });
  const out = new Map<string, string>();
  votes.forEach((v, alias) => out.set(alias, Array.from(v.entries()).sort((a, b) => b[1] - a[1])[0][0]));
  return out;
}

export function resolveClient(alias: string, clients: LinkClient[], learned: Map<string, string>): string | null {
  const key = alias.replace(/-ver-\d+$/, "");
  if (learned.has(key)) return learned.get(key)!;
  const exact = clients.find((c) => (c.code || "").toLowerCase() === key);
  if (exact) return exact.id;
  const k = lettersOnly(key);
  const close = clients.filter((c) => { const code = lettersOnly(c.code || ""); return code && (code === k || (k.length >= 4 && (code.startsWith(k) || k.startsWith(code)))); });
  return close.length === 1 ? close[0].id : null;
}

export function matchLinks(text: string, data: { blocks: LinkBlock[]; clients: LinkClient[]; publications: LinkPub[] }): { matches: LinkMatch[]; ignored: ReturnType<typeof parseLinks>["ignored"] } {
  const { links, ignored } = parseLinks(text);
  const blockById = new Map(data.blocks.map((b) => [b.id, b]));
  const learned = learnAliases(data.publications, blockById);
  const pubByBlock = new Map<string, LinkPub>(); data.publications.forEach((p) => { const cur = pubByBlock.get(p.blockId); if (!cur || p.v > cur.v) pubByBlock.set(p.blockId, p); });
  // produto já publicado: (alias sem versão, slug) → bloco
  const bySlug = new Map<string, string>();
  data.publications.forEach((p) => { const l = parseLinks(p.url).links[0]; if (l) bySlug.set(`${l.alias.replace(/-ver-\d+$/, "")}/${slugify(l.slug)}`, p.blockId); });

  const taken = new Map<string, number>(); // bloco → linha que já o pegou (dois links no mesmo bloco = erro)
  const matches = links.map((l): LinkMatch => {
    const clientId = resolveClient(l.alias, data.clients, learned);
    const base: LinkMatch = { ...l, clientId, blockId: null, how: "none", score: 0, existingPubId: null, existingUrl: null, candidates: [] };
    if (!clientId) return { ...base, problem: `Marca não reconhecida para "${l.alias}" — escolha na lista.` };
    const pool = data.blocks.filter((b) => b.clientId === clientId);
    const want = slugify(l.slug);

    let blockId: string | null = null; let how: MatchHow = "none"; let score = 0;
    const same = bySlug.get(`${l.alias.replace(/-ver-\d+$/, "")}/${want}`);
    if (same && blockById.get(same)?.clientId === clientId) { blockId = same; how = "same-product"; score = 1; }
    if (!blockId) {
      let t = pool.filter((b) => slugify(b.title) === want);
      // Produto cadastrado duas vezes com o mesmo nome: fica com o que ainda não tem publicação.
      if (t.length > 1) { const free = t.filter((b) => !pubByBlock.has(b.id)); if (free.length === 1) t = free; }
      if (t.length === 1) { blockId = t[0].id; how = "title"; score = 1; }
    }
    if (!blockId) { const t = pool.filter((b) => (b.sku && slugify(b.sku) === want) || (b.csku && slugify(b.csku) === want)); if (t.length === 1) { blockId = t[0].id; how = "sku"; score = 0.95; } }
    const ranked = pool.map((b) => ({ blockId: b.id, score: Math.max(similarity(l.slug, b.title), similarity(l.slug, b.sku || "")) })).filter((c) => c.score >= 0.4).sort((a, b) => b.score - a.score).slice(0, 6);
    if (!blockId && ranked.length && ranked[0].score >= 0.6 && (ranked.length === 1 || ranked[0].score - ranked[1].score >= 0.08)) { blockId = ranked[0].blockId; how = "similar"; score = ranked[0].score; }

    const pub = blockId ? pubByBlock.get(blockId) ?? null : null;
    const m: LinkMatch = { ...base, blockId, how, score, candidates: ranked, existingPubId: pub?.id ?? null, existingUrl: pub?.url ?? null };
    if (!blockId) m.problem = ranked.length ? "Mais de um bloco parecido — escolha na lista." : "Nenhum bloco parecido nesta marca — escolha na lista ou crie o bloco antes.";
    else if (taken.has(blockId)) m.problem = `Mesmo bloco da linha ${taken.get(blockId)} — confira.`;
    else taken.set(blockId, l.line);
    return m;
  });
  return { matches, ignored };
}

export const HOW_LABELS: Record<MatchHow, string> = {
  "same-product": "mesmo produto já publicado", title: "nome igual", sku: "SKU igual", similar: "nome parecido — conferir", none: "não encontrado",
};

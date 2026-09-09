/**
 * Dashboard de DEMONSTRAÇÃO — cliente "ArchTechTour" (alias `archtechtour`).
 *
 * Usado em vídeos/apresentações comerciais para mostrar a ferramenta a
 * prospects sem expor números de clientes reais. É a ÚNICA exceção à regra
 * "nunca inventar dados": os números aqui são fictícios, gerados de forma
 * determinística a partir do período pedido (mesmo período → mesmos números),
 * e NUNCA passam por Athena nem S3.
 *
 * Isolamento:
 * - o alias `archtechtour` não existe na `dim_client_alias` (Athena), então
 *   refresh-all, analytics-compute e Harvey nunca o enxergam;
 * - as rotas /api/analytics/* interceptam o alias ANTES de qualquer query;
 * - só aparece no seletor de admin (`/api/analytics/clients` sem `?todos=1`);
 *   um usuário `client` nunca cai nesse alias porque ele é resolvido pelo
 *   nome do cliente dele no dim.
 */
import type { AnalyticsJSON } from "./analytics-builder";

export const DEMO_ALIAS = "archtechtour";
export const DEMO_CLIENTE = "ArchTechTour";

export function isDemoAlias(alias: string): boolean {
  return alias.toLowerCase() === DEMO_ALIAS;
}

// ── PRNG determinístico (mulberry32) — seed vem do período ─────────────────
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}
function daysBetween(inicio: string, fim: string): number {
  const a = new Date(inicio + "T12:00:00Z").getTime();
  const b = new Date(fim + "T12:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

// Portfólio fictício da "marca" ArchTechTour. Slug segue o padrão real
// `{Cliente}-{Produto}` — `produtoDisplay` do builder tira o prefixo.
const PRODUTOS: Array<{ slug: string; peso: number; tempoSeg: number }> = [
  { slug: "ArchTechTour-Poltrona-Aurora",    peso: 22, tempoSeg: 214 },
  { slug: "ArchTechTour-Sofa-Horizonte",     peso: 18, tempoSeg: 258 },
  { slug: "ArchTechTour-Mesa-Lumen",         peso: 14, tempoSeg: 171 },
  { slug: "ArchTechTour-Cadeira-Vertice",    peso: 12, tempoSeg: 143 },
  { slug: "ArchTechTour-Luminaria-Orbe",     peso: 10, tempoSeg: 126 },
  { slug: "ArchTechTour-Estante-Trama",      peso: 9,  tempoSeg: 197 },
  { slug: "ArchTechTour-Banqueta-Duna",      peso: 8,  tempoSeg: 98 },
  { slug: "ArchTechTour-Namoradeira-Brisa",  peso: 7,  tempoSeg: 232 },
];

const ORIGENS: Array<{ origem: string; peso: number }> = [
  { origem: "www.archtechtour.com", peso: 57 },
  { origem: "Direto",               peso: 21 },
  { origem: "www.instagram.com",    peso: 10 },
  { origem: "www.google.com",       peso: 6 },
  { origem: "br.pinterest.com",     peso: 4 },
  { origem: "www.linkedin.com",     peso: 2 },
];

const CIDADES: Array<{ cidade: string; peso: number }> = [
  { cidade: "São Paulo",      peso: 41 },
  { cidade: "Rio de Janeiro", peso: 17 },
  { cidade: "Belo Horizonte", peso: 12 },
  { cidade: "Curitiba",       peso: 9 },
  { cidade: "Porto Alegre",   peso: 7 },
];

function produtoDisplay(slug: string): string {
  const partes = slug.split("-");
  return partes.length > 1
    ? partes.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
    : slug;
}

/** Gera o JSON de demonstração para o período. Determinístico por período. */
export function buildDemoAnalytics(inicio: string, fim: string): AnalyticsJSON {
  const rnd = mulberry32(hashSeed(`${DEMO_ALIAS}|${inicio}|${fim}`));
  const jitter = (base: number, amp = 0.15) => base * (1 + (rnd() * 2 - 1) * amp);
  const dias = daysBetween(inicio, fim);

  // 1. Sessões por dia — ~95 carregamentos/dia úteis, fim de semana cai,
  //    leve tendência de alta ao longo do período.
  const sessoes_por_dia: Array<{ data: string; sessoes: number }> = [];
  const d0 = new Date(inicio + "T12:00:00Z");
  for (let i = 0; i < dias; i++) {
    const d = new Date(d0);
    d.setUTCDate(d0.getUTCDate() + i);
    const dow = d.getUTCDay();
    const fimDeSemana = dow === 0 || dow === 6;
    const tendencia = 1 + (i / Math.max(1, dias - 1)) * 0.22;
    const base = (fimDeSemana ? 38 : 95) * tendencia;
    sessoes_por_dia.push({ data: toISO(d), sessoes: Math.max(8, Math.round(jitter(base, 0.22))) });
  }
  const sessoes_unicas = sessoes_por_dia.reduce((s, r) => s + r.sessoes, 0);

  // 2. KPIs derivados (proporções típicas de um cliente com boa performance)
  const usuarios_unicos = Math.round(sessoes_unicas * jitter(0.68, 0.04));
  const media_sessoes = Math.round((sessoes_unicas / usuarios_unicos) * 100) / 100;

  const sketchup = Math.round(sessoes_unicas * jitter(0.034, 0.1));
  const revit    = Math.round(sessoes_unicas * jitter(0.021, 0.1));
  const archicad = Math.round(sessoes_unicas * jitter(0.012, 0.1));
  const botao_ar     = Math.round(sessoes_unicas * jitter(0.041, 0.1));
  const botao_ar_ios = Math.round(sessoes_unicas * jitter(0.027, 0.1));
  const botao_whatsapp = Math.round(sessoes_unicas * jitter(0.016, 0.1));

  const total_downloads = sketchup + revit + archicad;
  const engajamento_real = total_downloads + botao_ar + botao_ar_ios + botao_whatsapp;
  const total_eventos = Math.round(sessoes_unicas * jitter(1.74, 0.05)) + engajamento_real;
  const tempo_medio_min = Math.round(jitter(3.7, 0.08) * 100) / 100;

  const eventos_por_tipo = [
    { rotulo: "botao_ar", total: botao_ar },
    { rotulo: "sketchup", total: sketchup },
    { rotulo: "botao_ar_ios", total: botao_ar_ios },
    { rotulo: "revit", total: revit },
    { rotulo: "botao_whatsapp", total: botao_whatsapp },
    { rotulo: "archicad", total: archicad },
  ].sort((a, b) => b.total - a.total);

  // 3. Engajamento por produto — distribui total_eventos pelos pesos
  const pesoTotal = PRODUTOS.reduce((s, p) => s + p.peso, 0);
  const engajamento_por_produto = PRODUTOS.map((p) => {
    const eventos = Math.round((total_eventos * p.peso) / pesoTotal * jitter(1, 0.08));
    const tempoSeg = Math.round(jitter(p.tempoSeg, 0.1));
    // sessões do produto ≈ eventos / (eventos por sessão); horas = sessões × tempo médio
    const sessoesProduto = eventos / 1.9;
    return {
      produto: p.slug,
      produto_display: produtoDisplay(p.slug),
      tempo_medio_sessao_seg: tempoSeg,
      tempo_total_h: Math.round((sessoesProduto * tempoSeg) / 3600 * 100) / 100,
      total_eventos: eventos,
    };
  }).sort((a, b) => b.total_eventos - a.total_eventos);

  // 4. Origem de acesso (sobre session_start = carregamentos)
  const pesoOrig = ORIGENS.reduce((s, o) => s + o.peso, 0);
  const origensRaw = ORIGENS.map((o) => ({
    origem: o.origem,
    total: Math.round((sessoes_unicas * o.peso) / pesoOrig * jitter(1, 0.06)),
  }));
  const totOrig = origensRaw.reduce((s, o) => s + o.total, 0) || 1;
  const origem_acesso = origensRaw
    .map((o) => ({ ...o, percentual: Math.round((o.total / totOrig) * 1000) / 10 }))
    .sort((a, b) => b.total - a.total);

  // 5. Cidades (na view real é contagem de eventos, por isso maior que sessões)
  const pesoCid = CIDADES.reduce((s, c) => s + c.peso, 0);
  const principais_cidades = CIDADES.map((c) => ({
    cidade: c.cidade,
    sessoes: Math.round((total_eventos * c.peso) / pesoCid * jitter(1, 0.07)),
  })).sort((a, b) => b.sessoes - a.sessoes);

  return {
    _meta: { is_demo: true, note: "Dados fictícios de demonstração — não vêm do Athena." },
    cliente: DEMO_CLIENTE,
    alias: DEMO_ALIAS,
    periodo: { inicio, fim, label: `${inicio} a ${fim}` },
    gerado_em: new Date().toISOString(),
    kpis: { usuarios_unicos, sessoes_unicas, media_sessoes, total_downloads, tempo_medio_min, total_eventos, engajamento_real },
    engajamento_por_produto,
    eventos_por_tipo,
    sessoes_por_dia,
    origem_acesso,
    principais_cidades,
  };
}

/** Período padrão do demo quando ninguém pediu um range: últimos 30 dias. */
export function demoDefaultRange(): { inicio: string; fim: string } {
  const hoje = new Date();
  const ini = new Date(hoje);
  ini.setDate(ini.getDate() - 29);
  return { inicio: toISO(ini), fim: toISO(hoje) };
}

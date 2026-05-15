/**
 * Constrói o JSON de analytics de um cliente rodando queries no Athena.
 * Espelha o script Python build_analytics.py — fonte da verdade do schema.
 */
import { runAthenaQuery, sqlEscape } from "./athena";

const DB = process.env.ATHENA_DB || "customizador_events";

export interface AnalyticsJSON {
  cliente: string;
  alias: string;
  periodo: { inicio: string; fim: string; label: string };
  gerado_em: string;
  kpis: {
    usuarios_unicos: number;
    sessoes_unicas: number;
    media_sessoes: number;
    total_downloads: number;
    tempo_medio_min: number;
    total_eventos: number;
  };
  engajamento_por_produto: Array<{
    produto: string;
    produto_display: string;
    tempo_medio_sessao_seg: number;
    tempo_total_h: number;
    total_eventos: number;
  }>;
  eventos_por_tipo: Array<{ rotulo: string; total: number }>;
  sessoes_por_dia: Array<{ data: string; sessoes: number }>;
  origem_acesso: Array<{ origem: string; total: number; percentual: number }>;
  principais_cidades: Array<{ cidade: string; sessoes: number }>;
}

const num = (v: string | undefined) => {
  if (!v) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};
const inum = (v: string | undefined) => Math.trunc(num(v));

function produtoDisplay(slug: string): string {
  if (!slug) return slug;
  const partes = slug.split("-");
  if (partes.length > 1) {
    return partes.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return slug;
}

export async function buildAnalytics(opts: {
  cliente: string;
  alias: string;
  inicio: string;
  fim: string;
}): Promise<AnalyticsJSON> {
  const cli = sqlEscape(opts.cliente);
  const inicio = sqlEscape(opts.inicio);
  const fim = sqlEscape(opts.fim);

  // 1. KPIs principais
  const kpiRows = await runAthenaQuery(`
    SELECT
      COUNT(DISTINCT user_id)   AS usuarios_unicos,
      COUNT(DISTINCT session_id) AS sessoes_unicas,
      COUNT(*)                   AS total_eventos
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${cli}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
  `);
  const kpi = kpiRows[0] || {};
  const usuarios_unicos = inum(kpi.usuarios_unicos);
  const sessoes_unicas = inum(kpi.sessoes_unicas);
  const total_eventos = inum(kpi.total_eventos);
  const media_sessoes = usuarios_unicos > 0
    ? Math.round((sessoes_unicas / usuarios_unicos) * 100) / 100
    : 0;

  // 2. Total de downloads
  const dlRows = await runAthenaQuery(`
    SELECT COUNT(*) AS total
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${cli}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
      AND (evento LIKE 'download%' OR evento = 'download_modelo')
  `);
  const total_downloads = inum(dlRows[0]?.total);

  // 3. Tempo médio aproximado — via vw_tempo_medio_aproximado_v2
  let tempo_medio_min = 0;
  try {
    const tmRows = await runAthenaQuery(`
      SELECT AVG(CAST(duracao_s AS DOUBLE)) AS media_seg
      FROM ${DB}.vw_tempo_medio_aproximado_v2
      WHERE cliente = '${cli}'
    `);
    tempo_medio_min = Math.round((num(tmRows[0]?.media_seg) / 60) * 100) / 100;
  } catch {
    // fallback: calcular pela view base
    const tmRows = await runAthenaQuery(`
      WITH sessoes AS (
        SELECT session_id,
               (MAX(CAST(timestamp AS bigint)) - MIN(CAST(timestamp AS bigint))) AS dur
        FROM ${DB}.vw_eventos_base_com_cliente
        WHERE cliente = '${cli}'
          AND data_evento BETWEEN '${inicio}' AND '${fim}'
        GROUP BY session_id
      )
      SELECT AVG(dur) AS media_seg FROM sessoes WHERE dur > 0 AND dur < 1800
    `);
    tempo_medio_min = Math.round((num(tmRows[0]?.media_seg) / 60) * 100) / 100;
  }

  // 4. Engajamento por produto (com dedup por case-insensitive)
  const engRows = await runAthenaQuery(`
    WITH sess_dur AS (
      SELECT produto, session_id,
             (MAX(CAST(timestamp AS bigint)) - MIN(CAST(timestamp AS bigint))) AS dur
      FROM ${DB}.vw_eventos_base_com_cliente
      WHERE cliente = '${cli}'
        AND data_evento BETWEEN '${inicio}' AND '${fim}'
      GROUP BY produto, session_id
    )
    SELECT
      e.produto,
      AVG(CASE WHEN s.dur > 0 AND s.dur < 1800 THEN s.dur ELSE NULL END) AS tempo_medio_seg,
      SUM(CASE WHEN s.dur > 0 AND s.dur < 1800 THEN s.dur ELSE 0 END) / 3600.0 AS tempo_total_h,
      COUNT(*) AS total_eventos
    FROM ${DB}.vw_eventos_base_com_cliente e
    LEFT JOIN sess_dur s ON e.session_id = s.session_id AND e.produto = s.produto
    WHERE e.cliente = '${cli}'
      AND e.data_evento BETWEEN '${inicio}' AND '${fim}'
    GROUP BY e.produto
    ORDER BY total_eventos DESC
    LIMIT 50
  `);

  // Dedup case-insensitive + filtra produtos com lixo HTML
  const agg = new Map<string, {
    produto: string;
    tempo_seg_sum: number;
    tempo_h: number;
    eventos: number;
  }>();
  for (const r of engRows) {
    const slug = r.produto || "";
    if (!slug || slug.startsWith("<") || slug.length > 100) continue;
    const key = slug.toLowerCase();
    const a = agg.get(key) || { produto: slug, tempo_seg_sum: 0, tempo_h: 0, eventos: 0 };
    const evts = inum(r.total_eventos);
    const tmSeg = num(r.tempo_medio_seg);
    // Mantém o slug com melhor capitalização
    if (slug.match(/^[A-Z]/) && !a.produto.match(/^[A-Z]/)) a.produto = slug;
    a.tempo_seg_sum += tmSeg * evts;
    a.tempo_h += num(r.tempo_total_h);
    a.eventos += evts;
    agg.set(key, a);
  }
  const engajamento_por_produto = Array.from(agg.values())
    .filter((a) => a.eventos > 0)
    .map((a) => ({
      produto: a.produto,
      produto_display: produtoDisplay(a.produto),
      tempo_medio_sessao_seg: Math.round(a.tempo_seg_sum / a.eventos),
      tempo_total_h: Math.round(a.tempo_h * 100) / 100,
      total_eventos: a.eventos,
    }))
    .sort((a, b) => b.total_eventos - a.total_eventos);

  // 5. Eventos por rotulo (filtra "abertura" / "fechamento" que são session lifecycle)
  const evtRows = await runAthenaQuery(`
    SELECT rotulo, COUNT(*) AS total
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${cli}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
      AND rotulo IS NOT NULL AND rotulo <> ''
      AND LOWER(rotulo) NOT IN ('abertura', 'fechamento', 'abertura_sessao', 'fechamento_sessao')
    GROUP BY rotulo
    ORDER BY total DESC
    LIMIT 10
  `);
  const eventos_por_tipo = evtRows.map((r) => ({
    rotulo: r.rotulo,
    total: inum(r.total),
  }));

  // 6. Sessões por dia
  const diaRows = await runAthenaQuery(`
    SELECT data_evento AS data, COUNT(DISTINCT session_id) AS sessoes
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${cli}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
    GROUP BY data_evento
    ORDER BY data_evento
  `);
  const sessoes_por_dia = diaRows.map((r) => ({
    data: r.data,
    sessoes: inum(r.sessoes),
  }));

  // 7. Origem de acesso (filtra localhost)
  const origemRows = await runAthenaQuery(`
    SELECT
      CASE
        WHEN referrer IS NULL OR referrer = '' THEN 'Direto'
        ELSE COALESCE(regexp_extract(referrer, 'https?://([^/]+)', 1), 'Direto')
      END AS origem,
      COUNT(*) AS total
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${cli}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
      AND evento = 'session_start'
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 8
  `);
  const origensFiltradas = origemRows
    .filter((r) => !r.origem.toLowerCase().includes("localhost"))
    .slice(0, 6);
  const totalOrigens = origensFiltradas.reduce((s, r) => s + inum(r.total), 0) || 1;
  const origem_acesso = origensFiltradas.map((r) => ({
    origem: r.origem,
    total: inum(r.total),
    percentual: Math.round((inum(r.total) / totalOrigens) * 1000) / 10,
  }));

  // 8. Principais cidades (vw_eventos_por_localizacao é agregada, sem data)
  let principais_cidades: Array<{ cidade: string; sessoes: number }> = [];
  try {
    const cidadeRows = await runAthenaQuery(`
      SELECT cidade, eventos
      FROM ${DB}.vw_eventos_por_localizacao
      WHERE cliente = '${cli}'
        AND cidade IS NOT NULL AND cidade <> ''
      ORDER BY eventos DESC
      LIMIT 5
    `);
    principais_cidades = cidadeRows.map((r) => ({
      cidade: r.cidade,
      sessoes: inum(r.eventos),
    }));
  } catch {
    // view sem dados
  }

  return {
    cliente: opts.cliente,
    alias: opts.alias,
    periodo: { inicio: opts.inicio, fim: opts.fim, label: `${opts.inicio} a ${opts.fim}` },
    gerado_em: new Date().toISOString(),
    kpis: { usuarios_unicos, sessoes_unicas, media_sessoes, total_downloads, tempo_medio_min, total_eventos },
    engajamento_por_produto,
    eventos_por_tipo,
    sessoes_por_dia,
    origem_acesso,
    principais_cidades,
  };
}

/** Salva o JSON: S3 (sempre que possível) + local em dev. */
export async function saveAnalytics(alias: string, data: AnalyticsJSON): Promise<void> {
  const body = JSON.stringify(data, null, 2);
  const isProd = process.env.NODE_ENV === "production";

  // 1. S3 (fonte de verdade em produção, cache em dev se configurado)
  const bucket = process.env.ANALYTICS_S3_BUCKET || "archtechtour-assets";
  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getS3 } = await import("./aws-clients");
    await getS3().send(new PutObjectCommand({
      Bucket: bucket,
      Key: `analytics-cache/${alias}/latest.json`,
      Body: body,
      ContentType: "application/json",
    }));
  } catch (err) {
    if (isProd) throw err; // em prod, S3 falhar é fatal
    console.warn("[analytics] S3 indisponível, salvando só local:", (err as Error).message);
  }

  // 2. Local (só em dev — em prod filesystem é read-only)
  if (!isProd) {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "public", "analytics-data", `${alias}.json`);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, body, "utf-8");
    } catch (err) {
      console.warn("[analytics] não foi possível salvar local:", err);
    }
  }
}

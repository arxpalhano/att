/**
 * Lambda: analytics-compute
 *
 * Disparo: EventBridge rule — "cron(0 3 10 * ? *)" → todo dia 10 às 03h00 UTC
 *
 * O que faz:
 *   1. Busca todos os clientes da dim_client_alias no Athena
 *   2. Para cada cliente, roda queries nas views e agrega as métricas
 *   3. Salva JSON em s3://{ANALYTICS_BUCKET}/analytics-cache/{alias}/latest.json
 *
 * Env vars da Lambda:
 *   ANALYTICS_BUCKET   → bucket de destino (ex: archtechtour-assets)
 *   ATHENA_DB          → banco do Athena (padrão: customizador_events)
 *   ATHENA_WORKGROUP   → workgroup (padrão: primary)
 *   ATHENA_OUTPUT      → s3://... onde o Athena grava os resultados temporários
 *   PERIODO_MESES      → quantos meses para trás (padrão: 1 — mês anterior completo)
 */

import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
} from "@aws-sdk/client-athena";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const athena = new AthenaClient({ region: "us-east-1" });
const s3 = new S3Client({ region: "us-east-1" });

const DB = process.env.ATHENA_DB || "customizador_events";
const WORKGROUP = process.env.ATHENA_WORKGROUP || "primary";
const ATHENA_OUTPUT = process.env.ATHENA_OUTPUT || "s3://archtechtour-assets/athena-tmp/";
const BUCKET = process.env.ANALYTICS_BUCKET || "archtechtour-assets";

// ============================================================
// HELPERS ATHENA
// ============================================================
async function runQuery(sql: string): Promise<Record<string, string>[]> {
  const start = await athena.send(new StartQueryExecutionCommand({
    QueryString: sql,
    QueryExecutionContext: { Database: DB },
    WorkGroup: WORKGROUP,
    ResultConfiguration: { OutputLocation: ATHENA_OUTPUT },
  }));

  const execId = start.QueryExecutionId!;
  // Poll até completar
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const status = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: execId }));
    const state = status.QueryExecution?.Status?.State;
    if (state === QueryExecutionState.SUCCEEDED) break;
    if (state === QueryExecutionState.FAILED || state === QueryExecutionState.CANCELLED) {
      const reason = status.QueryExecution?.Status?.StateChangeReason;
      throw new Error(`Athena query falhou [${execId}]: ${reason}`);
    }
  }

  const results = await athena.send(new GetQueryResultsCommand({ QueryExecutionId: execId }));
  const rows = results.ResultSet?.Rows || [];
  if (rows.length < 2) return [];

  const headers = rows[0].Data!.map((d) => d.VarCharValue || "");
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    row.Data!.forEach((cell, i) => { obj[headers[i]] = cell.VarCharValue || ""; });
    return obj;
  });
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function safeNum(v: string | undefined, fallback = 0): number {
  const n = parseFloat(v || "");
  return isNaN(n) ? fallback : n;
}

// ============================================================
// PERÍODO: mês anterior completo
// ============================================================
function getPeriodo(): { inicio: string; fim: string; label: string } {
  const hoje = new Date();
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth(), 0); // último dia do mês anterior
  const inicioMes = new Date(fimMes.getFullYear(), fimMes.getMonth(), 1);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const label = fimMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { inicio: fmt(inicioMes), fim: fmt(fimMes), label };
}

// ============================================================
// QUERIES POR CLIENTE
// ============================================================
async function computeClient(alias: string, nome: string, inicio: string, fim: string) {
  console.log(`[${alias}] Computando ${inicio} → ${fim}...`);

  // 1. KPIs principais
  const kpiRows = await runQuery(`
    SELECT
      COUNT(DISTINCT user_id)   AS usuarios_unicos,
      COUNT(DISTINCT session_id) AS sessoes_unicas,
      COUNT(*)                   AS total_eventos
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${nome}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
  `);
  const kpiRow = kpiRows[0] || {};
  const usuarios_unicos = safeNum(kpiRow.usuarios_unicos);
  const sessoes_unicas = safeNum(kpiRow.sessoes_unicas);
  const total_eventos = safeNum(kpiRow.total_eventos);
  const media_sessoes = usuarios_unicos > 0
    ? Math.round((sessoes_unicas / usuarios_unicos) * 100) / 100
    : 0;

  // 2. Total de downloads
  const dlRows = await runQuery(`
    SELECT COUNT(*) AS total_downloads
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${nome}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
      AND evento IN ('download_modelo', 'download')
  `);
  const total_downloads = safeNum(dlRows[0]?.total_downloads);

  // 3. Tempo médio aproximado (via vw_tempo_medio_aproximado, se existir)
  let tempo_medio_min = 0;
  try {
    const tmRows = await runQuery(`
      SELECT AVG(CAST(tempo_medio_seg AS DOUBLE)) / 60.0 AS tempo_medio_min
      FROM ${DB}.vw_tempo_medio_aproximado
      WHERE cliente = '${nome}'
        AND data_evento BETWEEN '${inicio}' AND '${fim}'
    `);
    tempo_medio_min = Math.round(safeNum(tmRows[0]?.tempo_medio_min) * 100) / 100;
  } catch {
    // view pode não existir — fallback: estimar via eventos
  }

  // 4. Engajamento por produto
  const engRows = await runQuery(`
    SELECT
      produto,
      COUNT(DISTINCT session_id) AS sessoes,
      COUNT(*) AS total_eventos
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${nome}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
    GROUP BY produto
    ORDER BY total_eventos DESC
    LIMIT 20
  `);
  const engajamento_por_produto = engRows.map((r) => {
    const slug = r.produto || "";
    const partes = slug.split("-");
    const display = partes.length > 1
      ? partes.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
      : slug;
    const sessoes = safeNum(r.sessoes) || 1;
    const totalEvt = safeNum(r.total_eventos);
    // estimativa de tempo médio sem dados reais: ~1.5 min/sessão
    const tempo_medio_sessao_seg = Math.round((tempo_medio_min * 60) || 90);
    const tempo_total_h = Math.round((sessoes * tempo_medio_sessao_seg / 3600) * 100) / 100;
    return {
      produto: slug,
      produto_display: display,
      tempo_medio_sessao_seg,
      tempo_total_h,
      total_eventos: totalEvt,
    };
  });

  // 5. Eventos por rotulo (tipo)
  const evtRows = await runQuery(`
    SELECT rotulo, COUNT(*) AS total
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${nome}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
      AND rotulo IS NOT NULL AND rotulo <> ''
    GROUP BY rotulo
    ORDER BY total DESC
    LIMIT 10
  `);
  const eventos_por_tipo = evtRows.map((r) => ({
    rotulo: r.rotulo,
    total: safeNum(r.total),
  }));

  // 6. Sessões por dia
  const diaRows = await runQuery(`
    SELECT data_evento AS data, COUNT(DISTINCT session_id) AS sessoes
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${nome}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
    GROUP BY data_evento
    ORDER BY data_evento
  `);
  const sessoes_por_dia = diaRows.map((r) => ({
    data: r.data,
    sessoes: safeNum(r.sessoes),
  }));

  // 7. Origem de acesso (via referrer)
  const origemRows = await runQuery(`
    SELECT
      COALESCE(
        regexp_extract(referrer, 'https?://([^/]+)', 1),
        'Direto'
      ) AS origem,
      COUNT(*) AS total
    FROM ${DB}.vw_eventos_base_com_cliente
    WHERE cliente = '${nome}'
      AND data_evento BETWEEN '${inicio}' AND '${fim}'
      AND evento = 'session_start'
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 6
  `);
  const totalAcessos = origemRows.reduce((s, r) => s + safeNum(r.total), 0) || 1;
  const origem_acesso = origemRows.map((r) => ({
    origem: r.origem,
    total: safeNum(r.total),
    percentual: Math.round((safeNum(r.total) / totalAcessos) * 1000) / 10,
  }));

  // 8. Principais cidades (via vw_eventos_por_localizacao, se existir)
  let principais_cidades: Array<{ cidade: string; sessoes: number }> = [];
  try {
    const cidadeRows = await runQuery(`
      SELECT cidade, COUNT(DISTINCT session_id) AS sessoes
      FROM ${DB}.vw_eventos_por_localizacao
      WHERE cliente = '${nome}'
        AND data_evento BETWEEN '${inicio}' AND '${fim}'
        AND cidade IS NOT NULL AND cidade <> ''
      GROUP BY cidade
      ORDER BY sessoes DESC
      LIMIT 5
    `);
    principais_cidades = cidadeRows.map((r) => ({
      cidade: r.cidade,
      sessoes: safeNum(r.sessoes),
    }));
  } catch {
    // view sem dados de geolocalização
  }

  return {
    cliente: nome,
    alias,
    periodo: { inicio, fim, label: getPeriodo().label },
    gerado_em: new Date().toISOString(),
    kpis: { usuarios_unicos, sessoes_unicas, media_sessoes, total_downloads, tempo_medio_min, total_eventos },
    engajamento_por_produto,
    eventos_por_tipo,
    sessoes_por_dia,
    origem_acesso,
    principais_cidades,
  };
}

// ============================================================
// HANDLER
// ============================================================
export const handler = async () => {
  const { inicio, fim } = getPeriodo();
  console.log(`Período: ${inicio} → ${fim}`);

  // Busca todos os clientes da dim
  const clientRows = await runQuery(`
    SELECT alias, cliente FROM ${DB}.dim_client_alias ORDER BY alias
  `);
  console.log(`Clientes encontrados: ${clientRows.length}`);

  const resultados: string[] = [];
  for (const row of clientRows) {
    const alias = row.alias.trim().toLowerCase();
    const nome = row.cliente.trim();
    try {
      const data = await computeClient(alias, nome, inicio, fim);
      const json = JSON.stringify(data, null, 2);
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: `analytics-cache/${alias}/latest.json`,
        Body: json,
        ContentType: "application/json",
      }));
      console.log(`[${alias}] ✓ salvo em s3://${BUCKET}/analytics-cache/${alias}/latest.json`);
      resultados.push(`${alias}: ok`);
    } catch (err) {
      console.error(`[${alias}] ✗ erro:`, err);
      resultados.push(`${alias}: erro`);
    }
  }

  return { statusCode: 200, body: resultados.join("\n") };
};

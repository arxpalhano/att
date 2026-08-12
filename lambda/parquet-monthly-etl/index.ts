/**
 * Lambda: parquet-monthly-etl
 *
 * Disparo: EventBridge → diário, 02h UTC
 *
 * O que faz:
 *   1. Escolhe os meses a processar (padrão: mês anterior + mês corrente)
 *   2. Para cada mês: APAGA os arquivos Parquet das partições do mês no S3,
 *      dropa as partições no Glue, e roda INSERT INTO eventos_parquet
 *      lendo do eventos_customizador (JSON) com filtro de timestamp no mês
 *   3. Particiona por dt (YYYY-MM-DD) automaticamente
 *
 * Pipeline geral:
 *   - Dia X: Lambda do customizador escreve JSONs em s3://explorar.archtechtour.com/eventos/
 *   - Diário: ESTA Lambda reconstrói o Parquet do mês corrente + anterior
 *   - Dia 1º: Lambda analytics-compute atualiza dashboards (lê do Parquet)
 *
 * ⚠️ IDEMPOTÊNCIA (bug corrigido em 2026-08):
 *   `ALTER TABLE ... DROP PARTITION` remove SÓ o metadado no Glue — os arquivos
 *   .parquet continuam no S3. Como o INSERT INTO recria a partição no MESMO
 *   prefixo, os arquivos antigos voltavam a ser lidos junto com os novos: cada
 *   execução diária somava uma cópia inteira do mês (jun/2026 chegou a 35x).
 *   Por isso o passo `deleteMonthPrefixes()` abaixo é OBRIGATÓRIO e roda ANTES
 *   do drop/insert. Não remover.
 *
 * Env vars:
 *   ATHENA_DB        → padrão: customizador_events
 *   ATHENA_OUTPUT    → s3://... onde Athena escreve resultados tmp
 *   PARQUET_BUCKET   → bucket da tabela eventos_parquet (padrão: archtechtour-assets)
 *   PARQUET_PREFIX   → prefixo da tabela (padrão: eventos-parquet)
 *   TARGET_MONTH     → opcional, formato YYYY-MM (ex: '2026-04') pra rodar manual.
 *                      Se vazio, usa mês anterior + corrente.
 */
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
} from "@aws-sdk/client-athena";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const athena = new AthenaClient({ region: "us-east-1" });
const s3 = new S3Client({ region: "us-east-1" });
const DB = process.env.ATHENA_DB || "customizador_events";
const ATHENA_OUTPUT = process.env.ATHENA_OUTPUT || "s3://explorar.archtechtour.com/athena-tmp/";
// Localização da tabela eventos_parquet (Glue: s3://archtechtour-assets/eventos-parquet)
const PARQUET_BUCKET = process.env.PARQUET_BUCKET || "archtechtour-assets";
const PARQUET_PREFIX = (process.env.PARQUET_PREFIX || "eventos-parquet").replace(/^\/+|\/+$/g, "");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mês anterior no formato YYYY-MM */
function previousMonth(): string {
  const hoje = new Date();
  const ano = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
  const mes = hoje.getMonth() === 0 ? 12 : hoje.getMonth();
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** Mês corrente no formato YYYY-MM */
function currentMonth(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** Calcula o primeiro dia do mês e do próximo (intervalo half-open) */
function monthRange(yyyymm: string): { start: string; nextStart: string } {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const nextStart = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { start, nextStart };
}

async function runAthena(sql: string, label: string): Promise<void> {
  console.log(`[${label}] iniciando...`);
  const start = await athena.send(new StartQueryExecutionCommand({
    QueryString: sql,
    QueryExecutionContext: { Database: DB },
    WorkGroup: "primary",
    ResultConfiguration: { OutputLocation: ATHENA_OUTPUT },
  }));
  const qid = start.QueryExecutionId!;
  console.log(`[${label}] query id: ${qid}`);

  let elapsed = 0;
  while (elapsed < 14 * 60 * 1000) { // max 14 min (Lambda limit 15min)
    await sleep(5000);
    elapsed += 5000;
    const exec = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: qid }));
    const state = exec.QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") {
      const stats = exec.QueryExecution?.Statistics;
      console.log(`[${label}] ✓ done in ${stats?.EngineExecutionTimeInMillis}ms, scanned ${stats?.DataScannedInBytes} bytes`);
      return;
    }
    if (state === "FAILED" || state === "CANCELLED") {
      const reason = exec.QueryExecution?.Status?.StateChangeReason || state;
      throw new Error(`Athena ${label} falhou: ${reason}`);
    }
    console.log(`[${label}] ${state} (${elapsed / 1000}s)`);
  }
  throw new Error(`Athena ${label} timeout (14min)`);
}

/** Lista os dias (YYYY-MM-DD) de um mês. */
function daysOfMonth(yyyymm: string): string[] {
  const [y, m] = yyyymm.split("-").map(Number);
  const total = new Date(y, m, 0).getDate();
  return Array.from({ length: total }, (_, i) => `${yyyymm}-${String(i + 1).padStart(2, "0")}`);
}

/**
 * Apaga os arquivos .parquet das partições do mês no S3.
 * Sem isso, DROP PARTITION + INSERT INTO duplica os dados (ver nota no topo).
 * Retorna quantos objetos foram removidos.
 */
async function deleteMonthPrefixes(targetMonth: string): Promise<number> {
  let removidos = 0;
  for (const dia of daysOfMonth(targetMonth)) {
    const Prefix = `${PARQUET_PREFIX}/dt=${dia}/`;
    let ContinuationToken: string | undefined;
    do {
      const list = await s3.send(new ListObjectsV2Command({
        Bucket: PARQUET_BUCKET, Prefix, ContinuationToken,
      }));
      const objetos = (list.Contents || []).map((o) => ({ Key: o.Key! }));
      if (objetos.length > 0) {
        // DeleteObjects aceita no máximo 1000 chaves por chamada
        for (let i = 0; i < objetos.length; i += 1000) {
          const lote = objetos.slice(i, i + 1000);
          const res = await s3.send(new DeleteObjectsCommand({
            Bucket: PARQUET_BUCKET, Delete: { Objects: lote, Quiet: true },
          }));
          if (res.Errors?.length) {
            throw new Error(`Falha ao apagar ${res.Errors.length} objeto(s) em ${Prefix}: ${res.Errors[0].Message}`);
          }
          removidos += lote.length;
        }
      }
      ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (ContinuationToken);
  }
  return removidos;
}

/** Processa 1 mês: limpa S3 + partições (idempotência) e re-insere do raw. */
async function processMonth(targetMonth: string): Promise<void> {
  const { start, nextStart } = monthRange(targetMonth);
  console.log(`--- Mês ${targetMonth}: ${start} → ${nextStart} ---`);

  // 1. Apaga os arquivos Parquet do mês no S3 (idempotência de verdade)
  const removidos = await deleteMonthPrefixes(targetMonth);
  console.log(`[s3-clean-${targetMonth}] ${removidos} objeto(s) removido(s) de s3://${PARQUET_BUCKET}/${PARQUET_PREFIX}/dt=${targetMonth}-*/`);

  // 2. Dropa as partições no Glue (metadado)
  try {
    const partitionSpecs = daysOfMonth(targetMonth).map((d) => `PARTITION (dt='${d}')`);
    await runAthena(`ALTER TABLE ${DB}.eventos_parquet DROP IF EXISTS ${partitionSpecs.join(", ")}`, `drop-${targetMonth}`);
  } catch (err) {
    console.warn(`Drop ${targetMonth} falhou (provável: sem partições):`, (err as Error).message);
  }

  // 3. INSERT do raw (CAST timestamp — coluna pode ser string)
  const insertSql = `
    INSERT INTO ${DB}.eventos_parquet
    SELECT evento, produto, categoria, rotulo, user_id, session_id, user_agent, referrer,
           "timestamp" AS ts, pais, estado, cidade, latitude, longitude, timezone, origem_trafego,
           date_format(from_unixtime(CAST("timestamp" AS bigint)), '%Y-%m-%d') AS dt
    FROM ${DB}.eventos_customizador
    WHERE from_unixtime(CAST("timestamp" AS bigint)) >= TIMESTAMP '${start} 00:00:00'
      AND from_unixtime(CAST("timestamp" AS bigint)) <  TIMESTAMP '${nextStart} 00:00:00'
  `;
  await runAthena(insertSql, `insert-${targetMonth}`);
}

export const handler = async (event?: { targetMonth?: string; targetMonths?: string[] }) => {
  // Manual: event.targetMonths (lista, p/ backfill), event.targetMonth ou TARGET_MONTH.
  // Cron diário: mês corrente + anterior (mantém o Parquet fresco sem esperar virar o mês).
  const manual = event?.targetMonths?.length
    ? event.targetMonths
    : event?.targetMonth || process.env.TARGET_MONTH
      ? [event?.targetMonth || process.env.TARGET_MONTH!]
      : null;
  const meses = manual ?? [previousMonth(), currentMonth()];

  const invalido = meses.find((m) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(m));
  if (invalido) throw new Error(`Mês inválido: "${invalido}" (esperado YYYY-MM)`);

  console.log(`============================================`);
  console.log(`Parquet ETL — processando: ${meses.join(", ")}`);
  console.log(`============================================`);

  for (const mes of meses) {
    await processMonth(mes);
  }

  console.log(`ETL concluído: ${meses.join(", ")}`);
  return { statusCode: 200, body: JSON.stringify({ processed: meses }) };
};

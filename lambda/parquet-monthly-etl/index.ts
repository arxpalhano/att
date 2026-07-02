/**
 * Lambda: parquet-monthly-etl
 *
 * Disparo: EventBridge → "cron(0 3 5 * ? *)" — todo dia 5 às 03h UTC
 *
 * O que faz:
 *   1. Calcula o mês anterior completo (ex: rodando 05/maio → migra abril)
 *   2. Roda INSERT INTO customizador_events.eventos_parquet ...
 *      lendo do eventos_customizador (JSON) com filtro de timestamp no mês
 *   3. Particiona por dt (YYYY-MM-DD) automaticamente
 *
 * Pipeline geral:
 *   - Dia X: Lambda do customizador escreve JSONs em s3://explorar.archtechtour.com/eventos/
 *   - Dia 5: ESTA Lambda migra o mês anterior pra Parquet (faster + cheaper)
 *   - Dia 10: Lambda analytics-compute atualiza dashboards (lê do Parquet)
 *
 * Idempotência: roda 2x no mesmo mês = duplica eventos.
 * Pra reproc: dropar partições do mês primeiro com ALTER TABLE DROP PARTITION.
 *
 * Env vars:
 *   ATHENA_DB        → padrão: customizador_events
 *   ATHENA_OUTPUT    → s3://... onde Athena escreve resultados tmp
 *   TARGET_MONTH     → opcional, formato YYYY-MM (ex: '2026-04') pra rodar manual.
 *                      Se vazio, usa mês anterior automaticamente.
 */
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
} from "@aws-sdk/client-athena";

const athena = new AthenaClient({ region: "us-east-1" });
const DB = process.env.ATHENA_DB || "customizador_events";
const ATHENA_OUTPUT = process.env.ATHENA_OUTPUT || "s3://explorar.archtechtour.com/athena-tmp/";

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

/** Processa 1 mês: dropa as partições (idempotência) e re-insere do raw. */
async function processMonth(targetMonth: string): Promise<void> {
  const { start, nextStart } = monthRange(targetMonth);
  console.log(`--- Mês ${targetMonth}: ${start} → ${nextStart} ---`);

  // 1. Dropa partições do mês (idempotência)
  try {
    const [y, m] = targetMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const partitionSpecs: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      partitionSpecs.push(`PARTITION (dt='${targetMonth}-${String(d).padStart(2, "0")}')`);
    }
    await runAthena(`ALTER TABLE ${DB}.eventos_parquet DROP IF EXISTS ${partitionSpecs.join(", ")}`, `drop-${targetMonth}`);
  } catch (err) {
    console.warn(`Drop ${targetMonth} falhou (provável: sem partições):`, (err as Error).message);
  }

  // 2. INSERT do raw (CAST timestamp — coluna pode ser string)
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

export const handler = async (event?: { targetMonth?: string }) => {
  // Manual: TARGET_MONTH ou event.targetMonth. Cron diário: mês corrente + anterior
  // (mantém o Parquet atualizado com dados frescos, sem esperar virada de mês).
  const meses = event?.targetMonth || process.env.TARGET_MONTH
    ? [event?.targetMonth || process.env.TARGET_MONTH!]
    : [previousMonth(), currentMonth()];

  console.log(`============================================`);
  console.log(`Parquet ETL — processando: ${meses.join(", ")}`);
  console.log(`============================================`);

  for (const mes of meses) {
    await processMonth(mes);
  }

  console.log(`ETL concluído: ${meses.join(", ")}`);
  return { statusCode: 200, body: JSON.stringify({ processed: meses }) };
};

/**
 * Lambda: analytics-compute
 *
 * Disparo: EventBridge → "cron(0 3 10 * ? *)" (todo dia 10 às 03h UTC)
 *
 * O que faz:
 *   1. Lê dim_client_alias no Athena → lista de clientes
 *   2. Para cada, chama POST /api/analytics/[alias]/refresh do Amplify
 *      com range = mês anterior completo
 *   3. O endpoint do Amplify roda as queries e salva o JSON no S3
 *
 * Vantagem: a Lambda fica burra. Toda a lógica está no Next.js (uma fonte só).
 *
 * Env vars:
 *   ANALYTICS_API_URL          → https://app.archtechtour.com (URL do Amplify)
 *   ANALYTICS_REFRESH_SECRET   → mesmo secret configurado no Amplify (opcional)
 *   ATHENA_DB                  → padrão: customizador_events
 *   ATHENA_OUTPUT              → s3://... onde Athena escreve tmp
 */
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";

const athena = new AthenaClient({ region: "us-east-1" });
const DB = process.env.ATHENA_DB || "customizador_events";
const ATHENA_OUTPUT = process.env.ATHENA_OUTPUT || "s3://explorar.archtechtour.com/athena-tmp/";
const API_URL = process.env.ANALYTICS_API_URL || "";
const SECRET = process.env.ANALYTICS_REFRESH_SECRET || "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function listClients(): Promise<Array<{ alias: string; cliente: string }>> {
  const start = await athena.send(new StartQueryExecutionCommand({
    QueryString: `SELECT alias, cliente FROM ${DB}.dim_client_alias ORDER BY alias`,
    QueryExecutionContext: { Database: DB },
    ResultConfiguration: { OutputLocation: ATHENA_OUTPUT },
  }));
  const qid = start.QueryExecutionId!;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const s = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: qid }));
    if (s.QueryExecution?.Status?.State === "SUCCEEDED") break;
    if (s.QueryExecution?.Status?.State === "FAILED") {
      throw new Error("Athena dim_client_alias falhou");
    }
  }
  const res = await athena.send(new GetQueryResultsCommand({ QueryExecutionId: qid }));
  const rows = res.ResultSet?.Rows?.slice(1) || [];
  return rows.map((r) => ({
    alias: (r.Data?.[0]?.VarCharValue || "").toLowerCase(),
    cliente: r.Data?.[1]?.VarCharValue || "",
  })).filter((c) => c.alias && c.cliente);
}

// Janela móvel de 30 dias (até ontem). Evita dashboard zerado no início
// do mês — sempre captura o tráfego mais recente, independente do calendário.
function getPeriodoUltimos30Dias(): { inicio: string; fim: string } {
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const fim = new Date();
  fim.setDate(fim.getDate() - 1); // até ontem (dia corrente pode estar incompleto)
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - 29); // 30 dias no total
  return { inicio: fmt(inicio), fim: fmt(fim) };
}

async function refreshClient(alias: string, inicio: string, fim: string): Promise<void> {
  const url = `${API_URL.replace(/\/$/, "")}/api/analytics/${alias}/refresh`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SECRET ? { "x-analytics-secret": SECRET } : {}),
    },
    body: JSON.stringify({ inicio, fim }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
}

export const handler = async (event?: { inicio?: string; fim?: string }) => {
  if (!API_URL) throw new Error("ANALYTICS_API_URL não configurado");

  // Período: usa o do payload (disparo manual) ou janela móvel de 30 dias (cron).
  const { inicio, fim } = (event?.inicio && event?.fim)
    ? { inicio: event.inicio, fim: event.fim }
    : getPeriodoUltimos30Dias();
  console.log(`Refresh: ${inicio} → ${fim}`);

  const clientes = await listClients();
  console.log(`Clientes encontrados: ${clientes.length}`);

  const results: string[] = [];
  for (const c of clientes) {
    try {
      console.log(`[${c.alias}] iniciando refresh...`);
      await refreshClient(c.alias, inicio, fim);
      console.log(`[${c.alias}] ✓ ok`);
      results.push(`${c.alias}: ok`);
    } catch (err) {
      console.error(`[${c.alias}] ✗`, (err as Error).message);
      results.push(`${c.alias}: ${(err as Error).message}`);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ periodo: { inicio, fim }, results }, null, 2),
  };
};

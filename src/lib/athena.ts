/**
 * Helper para rodar queries Athena de forma síncrona (await até completar).
 */
import {
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  paginateGetQueryResults,
} from "@aws-sdk/client-athena";
import { getAthena } from "./aws-clients";

const DB = process.env.ATHENA_DB || "customizador_events";
const WORKGROUP = process.env.ATHENA_WORKGROUP || "primary";
const OUTPUT = process.env.ATHENA_OUTPUT || "s3://explorar.archtechtour.com/athena-tmp/";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAthenaQuery(sql: string): Promise<Record<string, string>[]> {
  const athena = getAthena();

  const start = await athena.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: DB },
      WorkGroup: WORKGROUP,
      ResultConfiguration: { OutputLocation: OUTPUT },
    })
  );
  const qid = start.QueryExecutionId!;

  // Poll até completar (max 60s)
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const exec = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: qid }));
    const state = exec.QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") break;
    if (state === "FAILED" || state === "CANCELLED") {
      throw new Error(
        `Athena: ${exec.QueryExecution?.Status?.StateChangeReason || state}\nSQL: ${sql.slice(0, 200)}`
      );
    }
  }

  // Paginação
  const rows: Record<string, string>[] = [];
  let headers: string[] = [];
  let firstPage = true;

  for await (const page of paginateGetQueryResults({ client: athena }, { QueryExecutionId: qid })) {
    let pageRows = page.ResultSet?.Rows || [];
    if (firstPage && pageRows.length > 0) {
      headers = pageRows[0].Data!.map((d) => d.VarCharValue || "");
      pageRows = pageRows.slice(1);
      firstPage = false;
    }
    for (const row of pageRows) {
      const cells = row.Data!.map((d) => d.VarCharValue || "");
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = cells[i] || ""));
      rows.push(obj);
    }
  }
  return rows;
}

/** Escapa aspas simples pra evitar quebra de SQL. */
export function sqlEscape(v: string): string {
  return v.replace(/'/g, "''");
}

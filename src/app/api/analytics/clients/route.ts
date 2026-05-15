/**
 * GET  /api/analytics/clients
 *   → lista todos os clientes da dim_client_alias com flag de "tem JSON salvo"
 *
 * POST /api/analytics/clients
 *   Body: { alias: "novocli", cliente: "Nome do Cliente" }
 *   → INSERT INTO dim_client_alias
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
bootstrapAmplifyCredentials();

import { NextRequest, NextResponse } from "next/server";
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

export const maxDuration = 30;

const ATHENA_DB = process.env.ATHENA_DB || "customizador_events";
const ATHENA_OUTPUT = process.env.ATHENA_OUTPUT || "s3://explorar.archtechtour.com/athena-tmp/";
const ANALYTICS_BUCKET = process.env.ANALYTICS_S3_BUCKET || "archtechtour-assets";
const REGION = process.env.APP_AWS_REGION || "us-east-1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function listDim(): Promise<Array<{ alias: string; cliente: string }>> {
  const athena = new AthenaClient({ region: REGION });
  const start = await athena.send(new StartQueryExecutionCommand({
    QueryString: `SELECT alias, cliente FROM ${ATHENA_DB}.dim_client_alias ORDER BY cliente`,
    QueryExecutionContext: { Database: ATHENA_DB },
    WorkGroup: "primary",
    ResultConfiguration: { OutputLocation: ATHENA_OUTPUT },
  }));
  const qid = start.QueryExecutionId!;
  for (let i = 0; i < 30; i++) {
    await sleep(1500);
    const exec = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: qid }));
    const state = exec.QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") break;
    if (state === "FAILED" || state === "CANCELLED") {
      throw new Error(`Athena: ${exec.QueryExecution?.Status?.StateChangeReason || state}`);
    }
  }
  const results = await athena.send(new GetQueryResultsCommand({ QueryExecutionId: qid }));
  const rows = results.ResultSet?.Rows?.slice(1) || [];
  return rows.map((r) => ({
    alias: (r.Data?.[0]?.VarCharValue || "").toLowerCase(),
    cliente: r.Data?.[1]?.VarCharValue || "",
  })).filter((c) => c.alias && c.cliente);
}

async function getAnalyticsMeta(alias: string): Promise<{ has_data: boolean; last_updated: string | null; periodo: { inicio: string; fim: string } | null }> {
  // Tenta S3
  try {
    const s3 = new S3Client({ region: REGION });
    const res = await s3.send(new GetObjectCommand({
      Bucket: ANALYTICS_BUCKET,
      Key: `analytics-cache/${alias}/latest.json`,
    }));
    const body = await res.Body?.transformToString();
    if (body) {
      const json = JSON.parse(body);
      return {
        has_data: true,
        last_updated: json.gerado_em || null,
        periodo: json.periodo ? { inicio: json.periodo.inicio, fim: json.periodo.fim } : null,
      };
    }
  } catch {
    // sem dados no S3
  }
  return { has_data: false, last_updated: null, periodo: null };
}

export async function GET() {
  try {
    const dim = await listDim();
    const clients = await Promise.all(dim.map(async (c) => {
      const meta = await getAnalyticsMeta(c.alias);
      return { ...c, ...meta };
    }));
    return NextResponse.json({ clients });
  } catch (err) {
    const e = err as Error;
    // Debug detalhado: quais env vars estão presentes
    const allEnvKeys = Object.keys(process.env).sort();
    const awsRelated = allEnvKeys.filter(k => k.includes("AWS") || k.includes("AMPLIFY") || k.includes("CONTAINER"));
    return NextResponse.json(
      {
        error: `Falha ao listar clientes: ${e.message}`,
        name: e.name,
        stack: e.stack?.split("\n").slice(0, 8),
        region: REGION,
        athena_db: ATHENA_DB,
        athena_output: ATHENA_OUTPUT,
        has_container_creds: !!process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
        container_creds_value: process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ? "SET" : "MISSING",
        aws_related_env_keys: awsRelated,
        total_env_vars: allEnvKeys.length,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { alias, cliente } = body as { alias?: string; cliente?: string };

  if (!alias || !cliente) {
    return NextResponse.json(
      { error: "Body inválido. Esperado: { alias, cliente }" },
      { status: 400 }
    );
  }

  const aliasClean = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!aliasClean || !/^[a-z0-9]{2,30}$/.test(aliasClean)) {
    return NextResponse.json(
      { error: "Alias inválido. Use letras minúsculas e números, 2-30 chars." },
      { status: 400 }
    );
  }

  const sqlEsc = (v: string) => v.replace(/'/g, "''");
  const athena = new AthenaClient({ region: REGION });

  try {
    // Checa se já existe
    const checkStart = await athena.send(new StartQueryExecutionCommand({
      QueryString: `SELECT alias FROM ${ATHENA_DB}.dim_client_alias WHERE LOWER(alias) = '${sqlEsc(aliasClean)}' LIMIT 1`,
      QueryExecutionContext: { Database: ATHENA_DB },
      WorkGroup: "primary",
      ResultConfiguration: { OutputLocation: ATHENA_OUTPUT },
    }));
    const checkQid = checkStart.QueryExecutionId!;
    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      const s = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: checkQid }));
      const state = s.QueryExecution?.Status?.State;
      if (state === "SUCCEEDED") break;
      if (state === "FAILED" || state === "CANCELLED") {
        throw new Error(s.QueryExecution?.Status?.StateChangeReason || "check failed");
      }
    }
    const checkResult = await athena.send(new GetQueryResultsCommand({ QueryExecutionId: checkQid }));
    if ((checkResult.ResultSet?.Rows?.length || 0) > 1) {
      return NextResponse.json({ error: `Alias '${aliasClean}' já existe` }, { status: 409 });
    }

    // Insert
    const insertStart = await athena.send(new StartQueryExecutionCommand({
      QueryString: `INSERT INTO ${ATHENA_DB}.dim_client_alias (alias, cliente) VALUES ('${sqlEsc(aliasClean)}', '${sqlEsc(cliente)}')`,
      QueryExecutionContext: { Database: ATHENA_DB },
      WorkGroup: "primary",
      ResultConfiguration: { OutputLocation: ATHENA_OUTPUT },
    }));
    const insQid = insertStart.QueryExecutionId!;
    for (let i = 0; i < 30; i++) {
      await sleep(1500);
      const s = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: insQid }));
      const state = s.QueryExecution?.Status?.State;
      if (state === "SUCCEEDED") break;
      if (state === "FAILED" || state === "CANCELLED") {
        throw new Error(s.QueryExecution?.Status?.StateChangeReason || "insert failed");
      }
    }

    return NextResponse.json({ alias: aliasClean, cliente, created: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao inserir cliente: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

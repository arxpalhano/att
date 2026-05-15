/**
 * GET /api/debug/aws
 * Debug temporário — remover depois de diagnosticar.
 */
import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } from "@aws-sdk/client-athena";

export async function GET() {
  const awsEnvKeys = Object.keys(process.env)
    .filter((k) => k.startsWith("AWS_") || k.startsWith("APP_AWS") || k.startsWith("AMPLIFY"))
    .sort();

  // Tenta chamar o Amplify Credential Listener direto
  let listenerCall: any = { skipped: true };
  const host = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_HOST;
  const port = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_PORT;
  const lpath = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_PATH;
  if (host && port) {
    const url = `http://${host}:${port}${lpath || ""}`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const text = await r.text();
      listenerCall = {
        url,
        status: r.status,
        body_preview: text.slice(0, 500),
        body_length: text.length,
      };
    } catch (err) {
      listenerCall = { url, error: (err as Error).message };
    }
  }

  // Test 1: S3 GetObject (algo que temos permissão)
  let s3Test: any = { ok: false };
  try {
    const s3 = new S3Client({ region: "us-east-1" });
    const res = await s3.send(new GetObjectCommand({
      Bucket: "archtechtour-assets",
      Key: "analytics-cache/rsdesign/latest.json",
    }));
    const body = await res.Body?.transformToString();
    s3Test = { ok: true, bytes: body?.length || 0 };
  } catch (err) {
    s3Test = { ok: false, error: (err as Error).message };
  }

  // Test 2: Athena StartQueryExecution
  let athenaTest: any = { ok: false };
  try {
    const athena = new AthenaClient({ region: "us-east-1" });
    const res = await athena.send(new StartQueryExecutionCommand({
      QueryString: "SELECT 1",
      QueryExecutionContext: { Database: "customizador_events" },
      WorkGroup: "primary",
      ResultConfiguration: { OutputLocation: "s3://explorar.archtechtour.com/athena-tmp/" },
    }));
    athenaTest = { ok: true, query_id: res.QueryExecutionId };
  } catch (err) {
    athenaTest = { ok: false, error: (err as Error).message };
  }

  return NextResponse.json({
    commit: process.env.AWS_COMMIT_ID || "(not set)",
    branch: process.env.AWS_BRANCH || "(not set)",
    runtime: {
      node: process.version,
      execution_env: process.env.AWS_EXECUTION_ENV,
      aws_region_env: process.env.AWS_REGION,
      app_aws_region_env: process.env.APP_AWS_REGION,
      has_container_creds: !!process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
    },
    aws_env_keys: awsEnvKeys,
    tests: {
      s3_getobject_rsdesign: s3Test,
      athena_start_query_select_1: athenaTest,
      amplify_listener_call: listenerCall,
    },
  });
}

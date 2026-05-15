/**
 * GET /api/debug/aws
 * Debug temporário: lista quais env vars AWS_* estão presentes e tenta um
 * S3 ListBuckets() pra ver se IAM role tá funcionando.
 *
 * REMOVER depois que diagnosticar o deploy no Amplify.
 */
import { NextResponse } from "next/server";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

export async function GET() {
  // Quais env vars AWS_* estão setadas (só os nomes, sem valores)
  const awsEnvKeys = Object.keys(process.env)
    .filter((k) => k.startsWith("AWS_") || k.startsWith("APP_AWS") || k.startsWith("AMPLIFY"))
    .sort();

  // Testa SDK sem passar credentials → deixa default chain resolver
  let s3Test: { ok: boolean; buckets?: number; error?: string } = { ok: false };
  try {
    const s3 = new S3Client({ region: "us-east-1" });
    const res = await s3.send(new ListBucketsCommand({}));
    s3Test = { ok: true, buckets: res.Buckets?.length || 0 };
  } catch (err) {
    s3Test = {
      ok: false,
      error: (err as Error).message,
    };
  }

  return NextResponse.json({
    runtime: {
      node: process.version,
      platform: process.platform,
      execution_env: process.env.AWS_EXECUTION_ENV || "(not set)",
      lambda_function_name: process.env.AWS_LAMBDA_FUNCTION_NAME || "(not set)",
      lambda_function_version: process.env.AWS_LAMBDA_FUNCTION_VERSION || "(not set)",
    },
    aws_env_keys: awsEnvKeys,
    has_credential_envs: {
      AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
      AWS_SESSION_TOKEN: !!process.env.AWS_SESSION_TOKEN,
      AWS_REGION: process.env.AWS_REGION || null,
    },
    s3_list_buckets_test: s3Test,
  });
}

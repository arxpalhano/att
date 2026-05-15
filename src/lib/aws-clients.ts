/**
 * Clients AWS singletons.
 *
 * Em dev: usa AWS_ACCESS_KEY_ID/SECRET do .env.local
 * Em produção (Amplify/Lambda): SDK auto-detecta IAM Role anexado
 *   → não passamos credentials explicitamente, deixa o default provider
 *     chain resolver (env vars → IAM role → instance profile).
 */
import { S3Client } from "@aws-sdk/client-s3";
import { AthenaClient } from "@aws-sdk/client-athena";

// Em Amplify, env vars com prefixo AWS_* são reservadas → usamos APP_AWS_REGION.
// Default us-east-1 onde estão Athena + bucket archtechtour-assets.
const REGION = process.env.APP_AWS_REGION || process.env.AWS_REGION || "us-east-1";

function buildConfig() {
  // Deixa o SDK resolver credenciais via default provider chain.
  // - Dev local: pega AWS_ACCESS_KEY_ID/SECRET do .env.local
  // - Lambda/Amplify SSR: pega creds temporárias da IAM Role (com session token)
  // Passar credentials explicitamente sem sessionToken QUEBRA em Lambda.
  return { region: REGION };
}

let _s3: S3Client | null = null;
export function getS3(): S3Client {
  if (!_s3) _s3 = new S3Client(buildConfig());
  return _s3;
}

let _athena: AthenaClient | null = null;
export function getAthena(): AthenaClient {
  if (!_athena) _athena = new AthenaClient(buildConfig());
  return _athena;
}

/** True se temos como autenticar (env vars ou IAM role disponível). */
export function awsAvailable(): boolean {
  // Em produção AWS, mesmo sem env vars o SDK consegue resolver IAM role.
  // Em dev local sem .env, falha. Usamos NODE_ENV como heurística.
  return !!process.env.AWS_ACCESS_KEY_ID || process.env.NODE_ENV === "production";
}

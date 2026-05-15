/**
 * Factories AWS — cria um client fresh a cada chamada.
 *
 * IMPORTANTE: NÃO usar singleton. Em ECS Fargate (Amplify SSR usa AWS_ECS_EC2),
 * o processo Node persiste entre requests. Singleton pode pegar credenciais
 * temporárias expiradas ou ser criado em momento sem credentials.
 *
 * Default credential provider chain resolve sozinho:
 * - Dev local: AWS_ACCESS_KEY_ID/SECRET do .env.local
 * - Amplify SSR (ECS): AWS_CONTAINER_CREDENTIALS_RELATIVE_URI (auto)
 */
import { S3Client } from "@aws-sdk/client-s3";
import { AthenaClient } from "@aws-sdk/client-athena";

// Toda a infra de analytics está em us-east-1 (Athena DB, dim_client_alias,
// explorar.archtechtour.com bucket, archtechtour-assets bucket).
// Amplify SSR roda em sa-east-1 — fazemos cross-region pra acessar Athena.
// Resolvendo em runtime (cada call), NÃO no module load (env vars podem
// não estar prontas quando o módulo carrega).
function getRegion(): string {
  return process.env.APP_AWS_REGION || "us-east-1";
}

export function getS3(): S3Client {
  return new S3Client({ region: getRegion() });
}

export function getAthena(): AthenaClient {
  return new AthenaClient({ region: getRegion() });
}

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

// Em Amplify, env vars com prefixo AWS_* são reservadas → usamos APP_AWS_REGION.
// Default us-east-1 onde estão Athena + bucket archtechtour-assets.
const REGION = process.env.APP_AWS_REGION || process.env.AWS_REGION || "us-east-1";

export function getS3(): S3Client {
  return new S3Client({ region: REGION });
}

export function getAthena(): AthenaClient {
  return new AthenaClient({ region: REGION });
}

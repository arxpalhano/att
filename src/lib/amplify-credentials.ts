/**
 * Bootstrap de credenciais pro Amplify Hosting SSR.
 *
 * Amplify roda Next.js SSR em Lambda customizada SEM as env vars
 * AWS_ACCESS_KEY_ID/SECRET/SESSION_TOKEN (mecanismo deles é um sidecar HTTP).
 * Em vez disso, eles expõem AWS_AMPLIFY_CREDENTIAL_LISTENER_HOST/PORT/PATH.
 *
 * Setando AWS_CONTAINER_CREDENTIALS_FULL_URI pro endpoint do listener antes
 * de criar qualquer AWS client, o SDK trata como se fosse ECS metadata e
 * resolve credentials corretamente.
 *
 * Chamar UMA VEZ no topo do arquivo de cada API route que usa AWS.
 */
let _bootstrapped = false;

export function bootstrapAmplifyCredentials(): void {
  if (_bootstrapped) return;
  _bootstrapped = true;

  // Se já tem creds explícitas ou container URI, não mexer
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) return;
  if (process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI) return;
  if (process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) return;

  const host = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_HOST;
  const port = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_PORT;
  const path = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_PATH || "/";

  if (!host || !port) return; // não tá em Amplify

  process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI = `http://${host}:${port}${path}`;
  console.log(`[amplify-creds] AWS_CONTAINER_CREDENTIALS_FULL_URI=${process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI}`);
}

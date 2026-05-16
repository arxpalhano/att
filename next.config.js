/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bake env vars into the build so Amplify SSR Lambda can access them at runtime.
  // Amplify only injects vars during `npm run build`, not into the deployed Lambda environment.
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,
    APP_AWS_REGION: process.env.APP_AWS_REGION,
    ATHENA_DB: process.env.ATHENA_DB,
    ATHENA_WORKGROUP: process.env.ATHENA_WORKGROUP,
    ATHENA_OUTPUT: process.env.ATHENA_OUTPUT,
  },
};
module.exports = nextConfig;

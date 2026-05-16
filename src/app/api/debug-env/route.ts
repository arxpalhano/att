import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "SET" : "MISSING",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? `SET (${process.env.NEXTAUTH_SECRET.length} chars)` : "MISSING",
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? "SET" : "MISSING",
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ? "SET" : "MISSING",
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ? "SET" : "MISSING",
    NODE_ENV: process.env.NODE_ENV,
  });
}

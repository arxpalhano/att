import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? `SET(${process.env.NEXTAUTH_SECRET.length})` : "MISSING",
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? "SET" : "MISSING",
    APP_AWS_REGION: process.env.APP_AWS_REGION ?? "MISSING",
    ATHENA_DB: process.env.ATHENA_DB ?? "MISSING",
    NODE_ENV: process.env.NODE_ENV,
    ALL_KEYS: Object.keys(process.env).filter(k => !k.startsWith("AWS_CONT") && !k.startsWith("AWS_SEC") && !k.startsWith("AWS_ACCESS")).sort(),
  });
}

/** Versão do build em produção (sha do commit). O portal compara com a sua e avisa para recarregar. */
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ version: process.env.APP_VERSION || "unknown" }, { headers: { "Cache-Control": "no-store" } });
}

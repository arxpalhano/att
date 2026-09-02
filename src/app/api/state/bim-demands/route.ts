/**
 * Demandas de blocos BIM (terceirizados). Mesmo contrato das outras rotas de
 * estado: GET lista tudo; POST com array = replaceAll, com objeto = upsert.
 */
import { NextRequest, NextResponse } from "next/server";
import { bootstrapAmplifyCredentials } from "@/lib/amplify-credentials";
import { scanAll, putItem, replaceAll, TABLES } from "@/lib/dynamo";

bootstrapAmplifyCredentials();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await scanAll(TABLES.BIM_DEMANDS);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      await replaceAll(TABLES.BIM_DEMANDS, body);
      return NextResponse.json({ ok: true, count: body.length });
    }
    await putItem(TABLES.BIM_DEMANDS, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

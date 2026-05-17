import { NextRequest, NextResponse } from "next/server";
import { scanAll, putItem, replaceAll, TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await scanAll(TABLES.BLOCKS);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      await replaceAll(TABLES.BLOCKS, body);
      return NextResponse.json({ ok: true, count: body.length });
    }
    await putItem(TABLES.BLOCKS, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

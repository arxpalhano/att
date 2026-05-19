import { NextRequest, NextResponse } from "next/server";
import { scanAll, putItem, replaceAll, deleteItem, TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await scanAll(TABLES.PUBLICATIONS);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      await replaceAll(TABLES.PUBLICATIONS, body);
      return NextResponse.json({ ok: true, count: body.length });
    }
    await putItem(TABLES.PUBLICATIONS, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteItem(TABLES.PUBLICATIONS, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

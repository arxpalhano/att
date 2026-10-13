/**
 * GET /api/finance → espelho do Asaas (src/lib/finance.ts), já filtrado:
 *   - equipe interna: tudo (+ saldo, meta do sync)
 *   - cliente (role "client"): só cobranças/assinaturas/notas dos clientes Asaas
 *     vinculados ao clientId dele; sem saldo.
 * Quem é vem do cabeçalho x-att-actor (mesmo mecanismo das demais rotas).
 * Nunca chama o Asaas aqui — só lê o DynamoDB (limites de API, ver src/lib/asaas.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { readActor } from "@/lib/activity-server";
import { readFinance, filterForClient } from "@/lib/finance-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { actor } = await readActor(req);
    if (actor.id === "anon") return NextResponse.json({ error: "sem usuário" }, { status: 401 });
    const data = await readFinance();
    if (actor.role === "client") {
      if (!actor.clientId) return NextResponse.json({ error: "usuário cliente sem clientId" }, { status: 403 });
      return NextResponse.json(filterForClient(data, actor.clientId));
    }
    if (actor.role === "freelancer_bim") return NextResponse.json({ error: "sem acesso" }, { status: 403 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

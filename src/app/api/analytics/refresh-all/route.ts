/**
 * POST /api/analytics/refresh-all
 *
 * Dispara o refresh de TODOS os clientes na hora (sem esperar o cron do dia 10).
 * Invoca o Lambda analytics-compute de forma ASSÍNCRONA (InvocationType: Event)
 * — ele roda em background (até 10 min) percorrendo cada cliente do dim e
 * regenerando o cache no S3.
 *
 * Body opcional: { inicio: "YYYY-MM-DD", fim: "YYYY-MM-DD" }
 *   - Se enviado, usa esse período (ex: junho inteiro).
 *   - Se omitido, o Lambda usa janela móvel de 30 dias.
 */
import { NextRequest, NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const region = process.env.APP_AWS_REGION || "us-east-1";
    const body = await req.json().catch(() => ({} as { inicio?: string; fim?: string }));

    const payload: Record<string, string> = {};
    if (body.inicio && body.fim) {
      payload.inicio = body.inicio;
      payload.fim = body.fim;
    }

    const lambda = new LambdaClient({ region });
    await lambda.send(new InvokeCommand({
      FunctionName: "analytics-compute",
      InvocationType: "Event", // assíncrono — não espera terminar
      Payload: Buffer.from(JSON.stringify(payload)),
    }));

    return NextResponse.json({
      ok: true,
      message: body.inicio
        ? `Atualização disparada para o período ${body.inicio} a ${body.fim}. Todos os clientes serão regenerados em ~1-2 minutos.`
        : "Atualização disparada (últimos 30 dias). Todos os clientes serão regenerados em ~1-2 minutos.",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

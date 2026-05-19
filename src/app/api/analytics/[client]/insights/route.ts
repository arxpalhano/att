/**
 * POST /api/analytics/[client]/insights
 *
 * Recebe um snapshot de analytics e devolve uma interpretação amigável
 * em linguagem natural — pensada para o CLIENTE final entender o que
 * os números significam e qual o potencial da marca dele na plataforma.
 */
import { NextRequest, NextResponse } from "next/server";
import { callClaudeWithRetry } from "@/lib/claude-retry";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é um analista de dados da ArchTechTour explicando o dashboard
de analytics para o CLIENTE (marca de móveis/design) de forma clara, amigável e
prática. Seu objetivo: ajudar a marca a entender o POTENCIAL dela e o que os
números mostram, em linguagem de marketing/negócios — NÃO técnica.

Contexto: a plataforma ArchTechTour é usada por arquitetos para especificar
produtos. Cada customizador 3D é uma vitrine interativa. Os eventos coletados
medem o engajamento real desses arquitetos com a marca:
- "usuarios_unicos" = arquitetos distintos que abriram um customizador da marca
- "sessoes_unicas" = visitas (1 arquiteto pode visitar várias vezes)
- "total_downloads" = downloads de blocos (SketchUp/Revit/Archicad) — sinal forte
  de intenção de uso em projeto real
- "tempo_medio_min" = tempo médio que o arquiteto passa explorando produtos
- "btn_ar" = cliques no botão de Realidade Aumentada (intenção de visualizar
  no espaço real)
- "btn_whats" = cliques no botão WhatsApp (intenção de contato direto)
- "sketchup", "revit", "archicad" = downloads por formato CAD

## Formato (markdown CURTO, max 12 linhas, tom amigável)

**📊 O que esses números dizem sobre a sua marca**

Comece com uma frase IMPACTANTE traduzindo o número total de usuários únicos
em algo tangível (ex: "X arquitetos especificadores visitaram seus produtos
neste período — equivale a ~Y por dia").

Em seguida, 3-5 insights práticos:
- Produto destaque (o mais engajado, com nome real do produto e métrica)
- Sinal forte de intenção (downloads, AR, WhatsApp)
- Oportunidades (ex: "produto X tem 70% mais tempo de sessão que a média —
  considere destacar nas comunicações")
- Tendência (se houver dados diários, sazonalidade)

Termine com **1 ação prática** que a marca pode tomar com base nesses dados
(ex: "Compartilhe o link do produto destaque com sua equipe de vendas").

Use emojis com moderação (📊 🎯 💡 🚀). Não invente números. Se algum dado
estiver zerado ou ausente, fale com naturalidade. Tom: consultor parceiro,
não técnico, não vendedor agressivo.`;

export async function POST(req: NextRequest, { params }: { params: { client: string } }) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY ausente" }, { status: 500 });

    const data = await req.json();
    if (!data || typeof data !== "object") return NextResponse.json({ error: "payload inválido" }, { status: 400 });

    // Resumo enxuto pro modelo (evita enviar arrays gigantes)
    const summary = {
      cliente: data.cliente,
      periodo: data.periodo,
      kpis: data.kpis,
      top_produtos: (data.engajamento_por_produto || []).slice(0, 5),
      eventos_destaques: (data.eventos_por_tipo || []).slice(0, 6),
      cidades_top: (data.principais_cidades || []).slice(0, 5),
      origens: (data.origem_acesso || []).slice(0, 5),
    };

    const { text, usage, modelUsed } = await callClaudeWithRetry({
      apiKey, primaryModel: "claude-haiku-4-5", fallbackModel: "claude-sonnet-4-5",
      system: SYSTEM_PROMPT,
      userPrompt: `Analise o desempenho de "${data.cliente || params.client}" no período ${data.periodo?.label || ""} e gere a interpretação para o cliente:\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``,
      maxTokens: 1024,
    });

    return NextResponse.json({
      ok: true,
      insights: text,
      model: modelUsed,
      tokens: { input: usage.input_tokens, output: usage.output_tokens },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

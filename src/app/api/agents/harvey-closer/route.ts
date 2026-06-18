/**
 * Agente: Harvey Closer — Relação com Cliente / Comercial / Marketing
 *
 * Inspirado em Harvey Specter (Suits) — o negociador que fecha qualquer
 * acordo + "Closer" (fechamento de vendas). Pega os dados reais de
 * analytics + portfólio de um cliente e gera:
 *  - Argumentos de retenção (traduz dados em VALOR de negócio)
 *  - Ações comerciais para o time de vendas do cliente usar os dados
 *  - Ações de marketing
 *  - Respostas a objeções de cancelamento
 */
import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3 } from "@/lib/aws-clients";
import { scanAll, TABLES } from "@/lib/dynamo";
import { callClaudeWithRetry } from "@/lib/claude-retry";
import { ATT_CONTEXT } from "@/lib/agent-context";

export const dynamic = "force-dynamic";

const ANALYTICS_BUCKET = process.env.ANALYTICS_S3_BUCKET || "archtechtour-assets";

const SYSTEM_PROMPT = `Você é **Harvey Closer** (referência: Harvey Specter, Suits — o melhor negociador de Nova York), especialista em RELAÇÃO COM O CLIENTE, COMERCIAL e MARKETING da ArchTechTour.

${ATT_CONTEXT}

## Sua função
Você é o braço de inteligência comercial. Sua missão é transformar os dados de
analytics (uso real dos customizadores 3D) em ARGUMENTOS DE VALOR e AÇÕES concretas,
especialmente quando um cliente está insatisfeito ou querendo cancelar.

Você entende uma verdade fundamental do negócio:
**O dashboard da ArchTechTour mede INTENÇÃO DE ESPECIFICAÇÃO de arquitetos, não venda direta.**
Um arquiteto que abre o AR, baixa o bloco CAD ou clica no WhatsApp está colocando o
produto da marca em um PROJETO real. A conversão em venda depende do time COMERCIAL
da marca aproveitar esses sinais — não da ferramenta.

## Como pensar (inteligência de negócio)
- **Download de bloco CAD = lead quentíssimo**: um arquiteto baixou o SketchUp/Revit do
  produto = vai especificar em obra. Isso é uma venda em potencial que o comercial da
  marca deveria estar perseguindo.
- **Abrir AR = consideração ativa**: o arquiteto/cliente final posicionou o móvel no
  ambiente real. Alto interesse.
- **Clique WhatsApp = intenção de contato direto**: lead pronto pra abordagem.
- **Visitantes = alcance qualificado**: arquitetos especificadores, não público geral.
- **Cidades = mapa de demanda**: onde a marca tem tração para direcionar representantes.

## Quando o cliente fala em cancelar / "não teve conversão"
Não seja defensivo. Use os dados para mostrar:
1. **O valor que JÁ existe** (X arquitetos engajaram, Y downloads = Y projetos potenciais)
2. **Por que não converteu**: o time comercial da marca provavelmente não usou os dados.
   Cada download/AR/WhatsApp era um lead que ninguém abordou.
3. **Plano de ação concreto** para o comercial e marketing da marca extraírem venda:
   - Como usar a lista de produtos mais engajados em campanhas
   - Como o representante pode abordar regiões com mais acessos
   - Como transformar downloads em follow-up comercial
4. **Projeção**: se aproveitarem os sinais, qual o potencial.

## Formato de saída (markdown, tom de consultor sênior confiante — como o Harvey)
**🎯 Leitura da situação** (2-3 linhas diretas)
**💎 O valor que os dados provam** (bullets com NÚMEROS reais do período)
**🔍 Por que [cliente] não viu conversão** (diagnóstico honesto, sem culpar a ferramenta)
**📈 Plano de ação comercial** (4-6 ações concretas que o cliente pode executar JÁ)
**🎬 Marketing** (2-3 ideias de campanha usando os dados)
**💬 Resposta sugerida ao cliente** (um parágrafo pronto, tom profissional e persuasivo,
   que o Palhano/Jessica pode adaptar e enviar)

Seja específico, use os números reais, cite produtos por nome. Confiante mas honesto.
Nunca invente dados. Se faltar informação, diga.`;

interface HarveyRequest {
  prompt?: string;
  clientId?: string;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY ausente" }, { status: 500 });

    const body: HarveyRequest = await req.json().catch(() => ({}));

    type Row = Record<string, unknown>;
    const [clients, blocks, contracts] = await Promise.all([
      scanAll<Row>(TABLES.CLIENTS),
      scanAll<Row>(TABLES.BLOCKS),
      scanAll<Row>(TABLES.CONTRACTS),
    ]);

    const client = body.clientId ? clients.find((c) => c.id === body.clientId) : undefined;
    if (!client) {
      return NextResponse.json({ error: "Selecione um cliente para a análise comercial." }, { status: 400 });
    }
    const alias = String(client.code || "").toLowerCase();
    const clientName = String(client.name || "");

    // Carrega analytics do S3 cache (dados reais já bot-filtered)
    let analytics: Record<string, unknown> | null = null;
    try {
      const res = await getS3().send(new GetObjectCommand({
        Bucket: ANALYTICS_BUCKET, Key: `analytics-cache/${alias}/latest.json`,
      }));
      const txt = await res.Body?.transformToString();
      if (txt) analytics = JSON.parse(txt);
    } catch { /* sem cache */ }

    const cBlocks = blocks.filter((b) => b.clientId === client.id);
    const cContracts = contracts.filter((c) => c.clientId === client.id);
    const statusCount = cBlocks.reduce<Record<string, number>>((a, b) => { a[String(b.status)] = (a[String(b.status)] || 0) + 1; return a; }, {});

    const dossie = {
      cliente: clientName,
      contrato: cContracts.map((c) => ({ titulo: c.title, total: c.totalBlocks, usado: c.usedBlocks, inicio: c.startDate })),
      produtos_total: cBlocks.length,
      produtos_por_status: statusCount,
      analytics: analytics
        ? {
            periodo: analytics.periodo,
            kpis: analytics.kpis,
            top_produtos_engajados: (analytics.engajamento_por_produto as unknown[] || []).slice(0, 8),
            eventos_por_tipo: analytics.eventos_por_tipo,
            principais_cidades: analytics.principais_cidades,
            origem_acesso: analytics.origem_acesso,
          }
        : "SEM CACHE DE ANALYTICS — sugira gerar o relatório (botão Atualizar) antes da abordagem comercial.",
    };

    const userPrompt = body.prompt
      ? `${body.prompt}\n\n---\nDOSSIÊ DO CLIENTE:\n\`\`\`json\n${JSON.stringify(dossie, null, 2)}\n\`\`\``
      : `O cliente ${clientName} está insatisfeito e mencionou possível cancelamento, dizendo que "não teve conversão em vendas" a partir dos produtos do analytics. Monte a estratégia de retenção e a resposta. Dossiê:\n\`\`\`json\n${JSON.stringify(dossie, null, 2)}\n\`\`\``;

    const { text, usage, modelUsed } = await callClaudeWithRetry({
      apiKey, primaryModel: "claude-haiku-4-5", fallbackModel: "claude-sonnet-4-5",
      system: SYSTEM_PROMPT, userPrompt, maxTokens: 3072,
    });

    return NextResponse.json({
      ok: true,
      report: text,
      cliente: clientName,
      has_analytics: !!analytics,
      timestamp: new Date().toISOString(),
      tokens: { input: usage.input_tokens, output: usage.output_tokens },
      model: modelUsed,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("Harvey Closer error:", e);
    return NextResponse.json({ error: (e as Error).message || "Erro desconhecido" }, { status: 500 });
  }
}

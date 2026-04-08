/**
 * API Route: /api/analyze
 * Agente Claude para análise de qualidade dos materiais enviados pelos clientes.
 *
 * Analisa:
 * - Imagens: resolução, iluminação, nitidez, adequação para uso em 3D
 * - PDFs técnicos: presença de cotas, vistas, escala, legibilidade
 * - Arquivos CAD: formato correto, integridade básica
 *
 * Variável de ambiente necessária (.env.local):
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type AssetCategory = "cad" | "finishing" | "photos" | "videos" | "technical_drawing" | "3d_block" | "extra_reference";

interface AnalysisResult {
  score: number;          // 0–100
  approved: boolean;      // true se qualidade mínima atingida
  summary: string;        // resumo em português
  issues: string[];       // lista de problemas encontrados
  suggestions: string[];  // sugestões de melhoria
  checklist: { item: string; ok: boolean }[];
}

// Prompt especializado por categoria
function buildPrompt(category: AssetCategory, fileName: string): string {
  const prompts: Record<AssetCategory, string> = {
    photos: `Você é um especialista em análise de qualidade de imagens para uso em renderização e visualização 3D de produtos de design de interiores.

Analise esta imagem e avalie:
1. RESOLUÇÃO: A imagem tem resolução suficiente para referência 3D? (mínimo recomendado: 1200px no menor lado)
2. ILUMINAÇÃO: A iluminação é uniforme e permite ver detalhes do produto claramente?
3. NITIDEZ: A imagem está nítida, sem motion blur ou foco incorreto?
4. COBERTURA: A imagem mostra o produto completo com ângulos suficientes para modelagem?
5. FUNDO: O fundo é limpo ou interfere na leitura do produto?
6. COR E ACABAMENTO: As cores e acabamentos estão representados fielmente?`,

    technical_drawing: `Você é um especialista em análise de documentação técnica para produção de blocos 3D de móveis e produtos de design.

Analise este desenho técnico e avalie:
1. COTAS: O desenho contém todas as dimensões necessárias (largura, altura, profundidade, espessuras)?
2. VISTAS: Há vistas suficientes (frontal, lateral, superior) para modelagem completa?
3. ESCALA: A escala está indicada claramente?
4. LEGIBILIDADE: O texto e as linhas estão legíveis, sem sobreposição ou truncamento?
5. NORMAS: O desenho segue padrões técnicos (ISO ou ABNT)?
6. DETALHES: Há detalhes de encaixes, dobradiças, e mecanismos quando relevante?`,

    finishing: `Você é um especialista em materiais e acabamentos para design de interiores e modelagem 3D.

Analise este documento/imagem de acabamentos e avalie:
1. IDENTIFICAÇÃO: Os materiais estão claramente identificados (nome comercial, código, fornecedor)?
2. TEXTURAS: As texturas estão representadas em alta resolução para uso em renderização?
3. ESPECIFICAÇÕES: Há especificações técnicas (brilho, rugosidade, tipo de acabamento)?
4. VARIANTES: As opções de acabamento/cor estão todas listadas?
5. APLICAÇÃO: Está claro onde cada acabamento deve ser aplicado no produto?`,

    cad: `Você é um especialista em análise de arquivos CAD para modelagem 3D de produtos.

Com base no nome do arquivo e contexto fornecido, avalie:
1. FORMATO: O formato (.STEP, .DWG, etc.) é compatível com os softwares utilizados?
2. NOMENCLATURA: O nome do arquivo segue padrão identificável (produto + versão)?
3. VERSÃO: A versão do arquivo está indicada?`,

    videos: `Você é um especialista em análise de vídeos de referência para produtos de design.

Analise este vídeo/imagem e avalie a adequação como referência para modelagem:
1. QUALIDADE: A resolução e qualidade são adequadas?
2. CONTEÚDO: O vídeo mostra claramente o produto e seus mecanismos/movimentos?`,

    "3d_block": `Avalie este arquivo de bloco 3D fornecido como referência.`,
    extra_reference: `Avalie esta referência adicional quanto à utilidade para o projeto.`,
  };

  return `${prompts[category] || prompts.extra_reference}

Arquivo analisado: ${fileName}

Responda APENAS com um JSON válido neste formato exato (sem markdown, sem texto extra):
{
  "score": <número de 0 a 100>,
  "approved": <true se score >= 70, false se menor>,
  "summary": "<resumo em 1-2 frases em português>",
  "issues": ["<problema 1>", "<problema 2>"],
  "suggestions": ["<sugestão 1>", "<sugestão 2>"],
  "checklist": [
    { "item": "<critério avaliado>", "ok": <true/false> }
  ]
}`;
}

export async function POST(req: NextRequest) {
  try {
    const { fileUrl, fileName, category, mimeType } = await req.json();

    if (!fileUrl || !fileName || !category) {
      return NextResponse.json({ error: "Campos obrigatórios: fileUrl, fileName, category" }, { status: 400 });
    }

    const isImage = mimeType?.startsWith("image/") ||
      /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
    const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(fileName);

    let response;

    if (isImage) {
      // Analisar imagem diretamente via visão do Claude
      const imageResponse = await fetch(fileUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString("base64");
      const validMime = (mimeType && ["image/jpeg","image/png","image/gif","image/webp"].includes(mimeType))
        ? mimeType as "image/jpeg"|"image/png"|"image/gif"|"image/webp"
        : "image/jpeg";

      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: validMime, data: base64 },
            },
            {
              type: "text",
              text: buildPrompt(category as AssetCategory, fileName),
            },
          ],
        }],
      });
    } else if (isPdf) {
      // Para PDFs: usar URL pública ou descrever o contexto
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: buildPrompt(category as AssetCategory, fileName) +
            `\n\nNota: O arquivo PDF está disponível em: ${fileUrl}\n` +
            `Como não tenho acesso direto ao PDF neste momento, forneça uma avaliação baseada nos critérios e no nome do arquivo. ` +
            `Se a pontuação não puder ser determinada com precisão, use score: 0 e approved: false com a issue "PDF não pôde ser analisado automaticamente — revisão manual necessária."`,
        }],
      });
    } else {
      // Arquivo não visual (CAD, etc.) — análise por metadados
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: buildPrompt(category as AssetCategory, fileName) +
            `\n\nO arquivo não é uma imagem. Avalie apenas com base no nome, formato e categoria. ` +
            `Para formato correto, use score: 75 e approved: true. Para formato errado, score: 20 e approved: false.`,
        }],
      });
    }

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Resposta inesperada do Claude");
    }

    // Extrair JSON da resposta
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Claude não retornou JSON válido");
    }

    const result: AnalysisResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      ...result,
      analyzedAt: new Date().toISOString(),
      fileName,
      category,
    });
  } catch (err: unknown) {
    console.error("[Analyze Error]", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: `Erro na análise: ${message}` }, { status: 500 });
  }
}

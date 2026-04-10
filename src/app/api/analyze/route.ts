/**
 * API Route: /api/analyze
 * Agente Claude para análise de qualidade dos materiais enviados pelos clientes.
 *
 * Contexto: A ArchTechTour cria customizadores 3D interativos para indústria de móveis e design.
 * Os materiais recebidos dos clientes são usados para:
 *   - Modelagem 3D precisa do produto
 *   - Texturização realista
 *   - Integração no customizador (onde o usuário final configura acabamentos, cores, etc.)
 *
 * Fluxo de produção: Briefing → Materiais (CAD, fotos, acabamentos) → Modelagem → Texturização → Customizador → Publicação
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type AssetCategory = "cad" | "finishing" | "photos" | "videos" | "technical_drawing" | "3d_block" | "extra_reference";

interface AnalysisResult {
  score: number;
  approved: boolean;
  summary: string;
  issues: string[];
  suggestions: string[];
  checklist: { item: string; ok: boolean }[];
}

const CONTEXT = `
Você é o agente de qualidade da ArchTechTour, empresa especializada em criar customizadores 3D interativos para a indústria de móveis e design de interiores.

A ArchTechTour transforma produtos físicos em experiências digitais 3D onde o usuário final pode configurar acabamentos, cores e materiais em tempo real.

O fluxo de produção é:
1. Cliente envia materiais (CAD, fotos, desenhos técnicos, caderno de acabamentos)
2. Equipe de modelagem cria o modelo 3D a partir desses materiais
3. Texturização aplica os acabamentos reais ao modelo
4. O customizador 3D é publicado para uso comercial

Sua função é avaliar se os materiais recebidos têm qualidade suficiente para a equipe técnica criar modelos 3D precisos e realistas.
Seja objetivo e prático — pense como um modelador 3D experiente que precisa extrair informações do arquivo.
`;

function buildPrompt(category: AssetCategory, fileName: string): string {
  const prompts: Record<AssetCategory, string> = {

    photos: `${CONTEXT}

CATEGORIA ANALISADA: Fotos de Referência do Produto

As fotos serão usadas como referência visual para modelagem 3D e texturização.
O modelador precisa entender a geometria completa do produto, proporções, detalhes construtivos e acabamentos.

Avalie esta imagem nos seguintes critérios:

1. RESOLUÇÃO E NITIDEZ
   - A imagem tem resolução suficiente para ver detalhes? (mínimo 1.500px no menor lado)
   - Está nítida, sem motion blur, foco incorreto ou compressão excessiva?

2. COBERTURA DO PRODUTO
   - A foto mostra o produto inteiro (sem cortes importantes)?
   - Há múltiplos ângulos (frente, lateral, costas, detalhe)?
   - O modelador consegue entender a geometria 3D completa?

3. ILUMINAÇÃO
   - A iluminação é uniforme e revela os volumes e formas?
   - Não há sombras duras que escondam detalhes importantes?
   - As cores e acabamentos estão representados fielmente?

4. FUNDO E ENQUADRAMENTO
   - O fundo é neutro ou limpo, sem elementos que distraiam?
   - O produto está centralizado e bem enquadrado?

5. DETALHES CONSTRUTIVOS
   - Puxadores, dobradiças, pés, mecanismos de abertura estão visíveis?
   - Costuras, emendas e encaixes estão legíveis?`,

    technical_drawing: `${CONTEXT}

CATEGORIA ANALISADA: Desenho Técnico / Projeto Executivo

O desenho técnico é o documento mais crítico para modelagem 3D precisa.
O modelador depende dessas informações para criar geometria exata sem precisar de suposições.

Avalie este documento nos seguintes critérios:

1. DIMENSIONAMENTO COMPLETO
   - Largura, altura e profundidade totais estão cotadas?
   - Espessuras de chapas, tampos e painéis estão indicadas?
   - Dimensões de gavetas, portas e compartimentos estão presentes?

2. VISTAS NECESSÁRIAS
   - Vista frontal presente e legível?
   - Vista lateral presente?
   - Vista superior (planta) presente?
   - Cortes e seções para detalhes internos quando necessário?

3. ESCALA E PROPORÇÕES
   - A escala está claramente indicada (ex: 1:10, 1:20)?
   - As proporções do desenho são compatíveis com as cotas indicadas?

4. LEGIBILIDADE
   - O texto das cotas está legível (sem sobreposição)?
   - As linhas estão nítidas e sem ambiguidade?
   - Numeração de peças e legenda estão presentes?

5. MECANISMOS E ENCAIXES
   - Corrediças, dobradiças, trilhos e mecanismos de abertura estão detalhados?
   - Sistemas de encaixe (cavilha, parafuso, rebite) estão indicados?`,

    finishing: `${CONTEXT}

CATEGORIA ANALISADA: Caderno de Acabamentos / Especificação de Materiais

Os acabamentos são usados para criar os materiais PBR (Physically Based Rendering) do customizador.
O cliente final escolherá entre as opções de acabamento no customizador 3D.

Avalie este documento/imagem nos seguintes critérios:

1. IDENTIFICAÇÃO DOS MATERIAIS
   - Cada acabamento tem nome comercial e/ou código?
   - O fornecedor está identificado (ex: Eucatex, Arauco, Duratex)?
   - A referência/código do catálogo está presente?

2. QUALIDADE DAS AMOSTRAS
   - As texturas estão em alta resolução (mínimo 1.000px) para uso em renderização?
   - As cores estão representadas fielmente (sem distorção por má iluminação ou compressão)?

3. ESPECIFICAÇÕES TÉCNICAS
   - Tipo de acabamento (fosco, acetinado, brilhante, texturizado)?
   - Material base (MDF, MDP, madeira maciça, vidro, metal)?
   - Dimensão do padrão da textura (tile) quando aplicável?

4. COMPLETUDE
   - Todas as opções de cor/material estão listadas?
   - Está claro em qual componente do produto cada acabamento é aplicado?

5. APLICAÇÃO NO CUSTOMIZADOR
   - As variações são suficientes para criar um customizador interessante?
   - Os materiais têm diversidade visual para justificar a configuração 3D?`,

    cad: `${CONTEXT}

CATEGORIA ANALISADA: Arquivo CAD (Modelo 3D ou 2D técnico)

Arquivos CAD são usados diretamente como base para modelagem ou como referência precisa de geometria.

Com base no nome do arquivo e contexto, avalie:

1. FORMATO DO ARQUIVO
   - STEP (.step, .stp): ideal para importação direta em software 3D — ótimo
   - DWG / DXF: desenho técnico vetorial — bom para referência 2D
   - IGES (.iges, .igs): formato legado mas utilizável
   - Outros: avaliar compatibilidade

2. NOMENCLATURA E VERSIONAMENTO
   - O nome do arquivo identifica o produto claramente?
   - A versão está indicada no nome (ex: v2, v3, final)?
   - O arquivo não tem nome genérico como "arquivo1" ou "novo"?

3. COMPLETUDE ESPERADA
   - Para STEP: espera-se modelo sólido completo, não apenas superfícies
   - Para DWG: espera-se conjunto completo de vistas e cotas`,

    videos: `${CONTEXT}

CATEGORIA ANALISADA: Vídeo de Referência

Vídeos são úteis para entender mecanismos de abertura, movimentos e detalhes que fotos estáticas não capturam.

Avalie:

1. QUALIDADE DE IMAGEM
   - Resolução mínima: 1080p (Full HD)
   - Estabilização adequada (sem tremor excessivo)?
   - Iluminação suficiente para ver detalhes?

2. CONTEÚDO E COBERTURA
   - O vídeo mostra o produto em funcionamento/uso?
   - Mecanismos de abertura, dobradiças, gavetas, extensores estão demonstrados?
   - Há ângulos suficientes para entender a geometria 3D?

3. UTILIDADE PARA MODELAGEM
   - O vídeo acrescenta informações além das fotos estáticas?
   - Há close-ups de detalhes técnicos importantes?`,

    "3d_block": `${CONTEXT}

CATEGORIA ANALISADA: Bloco 3D / Modelo de Referência

Arquivo de modelo 3D fornecido como referência ou base para o trabalho.

Avalie com base no nome e formato:

1. FORMATO (GLB, GLTF, OBJ, FBX)
   - GLB/GLTF: formato moderno, ideal para web — excelente
   - OBJ: amplamente compatível — bom
   - FBX: compatível com maioria dos softwares 3D — bom

2. COMPLETUDE ESPERADA
   - O modelo deve ter geometria completa (não apenas aparência)
   - Texturas e materiais devem estar incluídos ou referenciados`,

    extra_reference: `${CONTEXT}

CATEGORIA ANALISADA: Referência Adicional

Material complementar para apoiar a produção do customizador 3D.

Avalie de forma geral:
1. O material tem conteúdo relevante para a produção?
2. Está legível e em boa qualidade?
3. Acrescenta informações não cobertas pelos outros materiais?`,
  };

  return `${prompts[category] || prompts.extra_reference}

Arquivo recebido: "${fileName}"

Responda APENAS com um JSON válido neste formato exato (sem markdown, sem texto extra fora do JSON):
{
  "score": <número inteiro de 0 a 100>,
  "approved": <true se score >= 70, false se menor — indica se a equipe consegue trabalhar com este material>,
  "summary": "<resumo em 1-2 frases em português, direto ao ponto>",
  "issues": ["<problema concreto 1>", "<problema concreto 2>"],
  "suggestions": ["<ação corretiva 1>", "<ação corretiva 2>"],
  "checklist": [
    { "item": "<critério avaliado>", "ok": <true/false> }
  ]
}`;
}

export async function POST(req: NextRequest) {
  try {
    const { fileUrl, fileName, category, mimeType } = await req.json();

    if (!fileUrl || !fileName || !category) {
      return NextResponse.json(
        { error: "Campos obrigatórios: fileUrl, fileName, category" },
        { status: 400 }
      );
    }

    const isImage =
      mimeType?.startsWith("image/") ||
      /\.(jpg|jpeg|png|webp|gif|tiff|bmp)$/i.test(fileName);
    const isPdf =
      mimeType === "application/pdf" || /\.pdf$/i.test(fileName);

    let response;

    if (isImage) {
      // Fetch image and analyze with Claude vision
      let base64: string;
      let validMime: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";

      try {
        const imgResp = await fetch(fileUrl);
        const buf = await imgResp.arrayBuffer();
        base64 = Buffer.from(buf).toString("base64");
        if (mimeType && ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)) {
          validMime = mimeType as typeof validMime;
        } else if (/\.png$/i.test(fileName)) {
          validMime = "image/png";
        } else if (/\.webp$/i.test(fileName)) {
          validMime = "image/webp";
        }
      } catch {
        // If we can't fetch, analyze by filename only
        base64 = "";
      }

      if (base64) {
        response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
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
      } else {
        // Fallback: analyze by filename
        response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: buildPrompt(category as AssetCategory, fileName) +
              `\n\nNota: não foi possível acessar a imagem diretamente. Avalie com base no nome do arquivo e retorne score: 0, approved: false, com issue "Imagem não pôde ser acessada para análise visual".`,
          }],
        });
      }
    } else if (isPdf) {
      // PDFs: analyze by filename + criteria (Claude doesn't read PDFs directly via URL)
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content:
            buildPrompt(category as AssetCategory, fileName) +
            `\n\nNota importante: Este é um arquivo PDF. Não é possível ler o conteúdo diretamente aqui.
Retorne uma avaliação parcial com:
- score: 55 (padrão para PDF não analisado visualmente)
- approved: false
- summary: indicando que o PDF foi recebido mas requer revisão manual pela equipe técnica
- issues: ["PDF não pode ser analisado automaticamente — revisão manual necessária pela equipe de modelagem"]
- suggestions: instruções práticas de como o cliente pode melhorar o documento baseado nos critérios acima
- checklist: com os critérios listados acima marcados como false (não verificados)`,
        }],
      });
    } else {
      // CAD, video, other binary — analyze by filename/format
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content:
            buildPrompt(category as AssetCategory, fileName) +
            `\n\nNota: Este é um arquivo binário (${mimeType || "formato desconhecido"}). Analise apenas com base no nome e formato do arquivo.`,
        }],
      });
    }

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Resposta inesperada do Claude");
    }

    // Extract JSON from response
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
    return NextResponse.json(
      { error: `Erro na análise: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * API Route: /api/analyze
 * Agente de qualidade Claude para análise dos materiais enviados pelos clientes.
 *
 * CONTEXTO DA EMPRESA:
 * A ArchTechTour cria customizadores 3D interativos (via Verge3D + Blender) para a indústria
 * de móveis e design de interiores. O produto final é uma aplicação web onde o usuário final
 * configura acabamentos, cores e materiais em tempo real no modelo 3D — com suporte a AR (WebXR).
 *
 * FLUXO DE PRODUÇÃO:
 * 1. Cliente envia materiais via portal (fotos, CAD, desenhos técnicos, caderno de acabamentos)
 * 2. Modelador baixa os arquivos, cria pasta no App Manager do Verge3D
 * 3. Modelagem/retopologia a partir do .skp ou .obj do cliente (geralmente baixa qualidade)
 * 4. Texturização: remoção de seams com Pix Plant 5, ajuste de cor, montagem no Blender
 *    (shader: Base Color + Normal Map no Principled BSDF)
 * 5. UV Mapping: mínimo de cortes, cortes escondidos, escala correta
 * 6. Exportação FBX → configuração Verge3D (iluminação, câmera, zoom) → exportação GLTF/GLB
 * 7. Desenvolvedor (Liles) programa a interatividade via Puzzles e main.js
 * 8. Publicação no AWS com suporte a desktop, mobile e AR
 *
 * Padrões técnicos da equipe:
 * - Texturas: potências de 2 (512–2048px), JPEG/PNG, tileable quando possível
 * - Nomenclatura: tipo_material_variante (ex: madeira_carvalho_escura_difusa)
 * - Materiais no Blender devem coincidir com nomes nos Puzzles (ex: Material_Madeira)
 * - Modelos LOW POLY — performance é prioridade para web e AR
 * - Formatos de troca: FBX, OBJ, GLTF/GLB, STEP/STP
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type AssetCategory =
  | "cad"
  | "finishing"
  | "photos"
  | "videos"
  | "technical_drawing"
  | "3d_block"
  | "extra_reference";

interface AnalysisResult {
  score: number;
  approved: boolean;
  summary: string;
  issues: string[];
  suggestions: string[];
  checklist: { item: string; ok: boolean }[];
}

// ─── CONTEXTO BASE (sempre incluído) ──────────────────────────────────────────
const BASE_CONTEXT = `
Você é o agente de qualidade da ArchTechTour.

A ArchTechTour cria customizadores 3D interativos via Verge3D (motor web) + Blender.
O produto final é uma aplicação web onde o usuário final configura acabamentos, cores e materiais
em tempo real no modelo 3D, com suporte a AR (WebXR) em smartphones.

O fluxo de produção é:
1. Cliente envia materiais (fotos, CAD, desenhos técnicos, caderno de acabamentos)
2. Modelador faz retopologia/modelagem a partir dos arquivos do cliente no Blender
3. Texturização: remoção de seams com Pix Plant 5, ajuste de cor/tamanho, montagem no Blender
   usando shader Principled BSDF com Base Color + Normal Map
4. UV Mapping com mínimo de cortes e menor distorção possível
5. Exportação FBX → configuração cena Verge3D → exportação GLTF/GLB → publicação AWS
6. Desenvolvedor programa interatividade: troca de texturas/materiais via Puzzles + main.js

Padrões técnicos:
- Texturas em potências de 2: 512×512, 1024×1024, 2048×2048 (máx)
- JPEG para texturas fotográficas, PNG apenas quando há transparência
- Modelos LOW POLY (performance web e AR é prioridade)
- Nomenclatura: tipo_material_variante sem espaços (ex: madeira_carvalho_escura)
- Formatos de modelo aceitos: SKP, OBJ, FBX, GLTF/GLB, STEP/STP, DWG

Avalie como um modelador 3D experiente que precisa saber se consegue trabalhar com este arquivo.
`;

// ─── PROMPTS POR CATEGORIA ─────────────────────────────────────────────────────
function buildPrompt(category: AssetCategory, fileName: string): string {
  const prompts: Record<AssetCategory, string> = {

    // ── FOTOS ──────────────────────────────────────────────────────────────────
    photos: `${BASE_CONTEXT}

CATEGORIA: Fotos de Referência do Produto

As fotos são a principal fonte de informação para o modelador construir a geometria 3D do produto.
São usadas para entender: forma geral, proporções, detalhes construtivos, acabamentos e texturas.
De acordo com o processo da equipe, o modelador precisa especialmente de:
- Imagens frontais, laterais, superiores, perspectiva E close-ups
- Detalhes de costuras, acabamentos, puxadores, dobradiças, mecanismos
- Informações que permitem definir a posição dos loops de corte para UV Mapping realista

Avalie visualmente esta imagem:

1. COBERTURA E ÂNGULOS
   ✓ Tem vista frontal clara?
   ✓ Tem vista lateral?
   ✓ Tem vista superior (topo)?
   ✓ Tem perspectiva ou 3/4?
   ✓ Há close-ups de detalhes construtivos (costuras, puxadores, dobradiças, pés, encaixes)?

2. RESOLUÇÃO E NITIDEZ
   ✓ A imagem tem resolução suficiente para ver detalhes? (mínimo ~1500px no menor lado)
   ✓ Está nítida? Sem motion blur, foco incorreto ou artefatos de compressão JPEG?
   ✓ Os detalhes finos (costura, textura de tecido, fio de madeira, vincos) são legíveis?

3. ILUMINAÇÃO E CORES
   ✓ A iluminação é difusa e uniforme, revelando volumes e formas sem sombras duras?
   ✓ As cores e acabamentos estão representados fielmente (sem superexposição ou subexposição)?
   ✓ A tonalidade, saturação e intensidade dos reflexos são visíveis para guiar a texturização?

4. ENQUADRAMENTO E FUNDO
   ✓ O produto está completo no quadro, sem partes cortadas?
   ✓ O fundo é neutro (branco, cinza ou sem distrações)?
   ✓ Não há objetos de cena ou perspectivas de ambiente que dificultem a leitura da forma?

5. DETALHES PARA MODELAGEM
   ✓ Mecanismos de abertura (dobradiças, corrediças, trilhos) estão visíveis?
   ✓ Costuras, zíperes, etiquetas, laços ou nós aparecem claramente (para produtos estofados)?
   ✓ Puxadores, encaixes, parafusos e transições de material são identificáveis?`,

    // ── DESENHO TÉCNICO ────────────────────────────────────────────────────────
    technical_drawing: `${BASE_CONTEXT}

CATEGORIA: Desenho Técnico / Projeto Executivo

ATENÇÃO: De acordo com os manuais da equipe de modelagem, a maioria dos desenhos técnicos
recebidos de clientes são "meramente ilustrativos e não representam o produto real perfeitamente".
Sua avaliação deve identificar se este desenho tem qualidade suficiente para guiar a modelagem,
ou se será apenas uma referência aproximada.

O modelador precisa extrair deste documento:
- Dimensões reais em cm ou mm (largura × altura × profundidade total)
- Espessuras de chapas, tampos, painéis laterais
- Dimensões de gavetas, portas, prateleiras, compartimentos
- Posição e detalhes de mecanismos (dobradiças, corrediças, trilhos)
- Vistas suficientes para entender a geometria 3D completa

Avalie este documento:

1. DIMENSIONAMENTO E COTAS
   ✓ Largura, altura e profundidade totais estão cotadas?
   ✓ Espessuras de chapas e painéis estão indicadas?
   ✓ Dimensões internas (gavetas, portas, compartimentos) estão presentes?
   ✓ As cotas são legíveis sem sobreposição de texto?

2. VISTAS PRESENTES
   ✓ Vista frontal presente e legível?
   ✓ Vista lateral presente?
   ✓ Vista superior (planta) presente?
   ✓ Cortes ou seções para detalhes internos, quando necessário?

3. LEGIBILIDADE E QUALIDADE
   ✓ As linhas estão nítidas, sem ambiguidade?
   ✓ A escala está indicada (ex: 1:10, 1:20) ou as cotas são suficientes?
   ✓ Numeração de peças, legenda ou referências estão presentes?
   ✓ O documento está em resolução suficiente para leitura dos detalhes?

4. MECANISMOS E DETALHES CONSTRUTIVOS
   ✓ Dobradiças, corrediças, trilhos estão detalhados?
   ✓ Sistemas de encaixe (cavilha, parafuso, dovetail) estão indicados?
   ✓ Mecanismos de abertura (push-to-open, soft-close) estão especificados?

5. UTILIDADE REAL PARA MODELAGEM
   ✓ O modelador consegue determinar todas as dimensões sem suposições?
   ✓ A geometria 3D pode ser reconstruída apenas com este documento?`,

    // ── ACABAMENTOS ───────────────────────────────────────────────────────────
    finishing: `${BASE_CONTEXT}

CATEGORIA: Caderno de Acabamentos / Especificação de Materiais

Os acabamentos são usados para criar os materiais PBR do Verge3D customizador.
Cada opção de acabamento vira uma textura tileable no Blender (Base Color + Normal Map no Principled BSDF).
O cliente final escolhe entre essas opções no customizador 3D.

Padrões técnicos da equipe:
- A equipe usa Pix Plant 5 para remover seams de texturas
- Texturas são organizadas no Blender por material com shaders PBR
- Nomenclatura: tipo_material_variante_sufixo (ex: madeira_carvalho_escura_difusa)
- Resolução ideal: 1024×1024 ou 2048×2048, potências de 2, JPEG ou PNG

Avalie este documento/imagem:

1. IDENTIFICAÇÃO DOS ACABAMENTOS
   ✓ Cada acabamento tem nome comercial e/ou código identificador?
   ✓ O fornecedor está identificado? (ex: Eucatex, Arauco, Duratex, Portinari, etc.)
   ✓ A referência/código de catálogo está presente para reordem?

2. QUALIDADE DAS AMOSTRAS PARA TEXTURIZAÇÃO
   ✓ As texturas/amostras estão em alta resolução (mínimo ~1000px)?
   ✓ As cores representam fielmente o material real? (sem distorção, iluminação uniforme)
   ✓ O padrão da textura (veio de madeira, trama de tecido, etc.) está claramente visível?
   ✓ A textura é tileable (padrão que se repete de forma contínua)?

3. ESPECIFICAÇÕES TÉCNICAS
   ✓ Tipo de acabamento está indicado? (fosco, acetinado, brilhante, texturizado, natural)
   ✓ Material base está claro? (MDF, MDP, madeira maciça, vidro, metal, tecido, couro)
   ✓ Dimensão do padrão (tile) está indicada quando relevante?

4. COMPLETUDE DO CATÁLOGO
   ✓ Todas as opções de cor/material estão listadas?
   ✓ Está claro em qual componente do produto cada acabamento é aplicado?
   ✓ As variações têm diversidade visual suficiente para um customizador interessante?

5. APROVEITAMENTO NO CUSTOMIZADOR
   ✓ As texturas têm qualidade suficiente para uso direto (sem precisar buscar substituto)?
   ✓ Há seams visíveis que exigirão tratamento no Pix Plant 5?
   ✓ Repetição muito evidente que pode forçar busca de textura alternativa na internet?`,

    // ── CAD ───────────────────────────────────────────────────────────────────
    cad: `${BASE_CONTEXT}

CATEGORIA: Arquivo CAD (Modelo 3D ou Projeto 2D técnico)

Arquivos CAD são usados como base para modelagem ou referência geométrica precisa.
De acordo com os manuais da equipe:
- O cliente geralmente envia arquivos .skp (SketchUp) ou .obj — frequentemente de baixa qualidade
- Qualidade insuficiente de modelagem exige retopologia completa no Blender
- O ideal é que o arquivo chegue com: geometria separada por tipo de material, UV aberta,
  objeto centralizado na origem, normais corretas e escala real em cm/m
- Formatos aceitos de troca: FBX, OBJ, GLTF/GLB (melhor para web), STEP/STP, DWG/DXF

Avalie com base no nome e formato do arquivo "${fileName}":

1. FORMATO E COMPATIBILIDADE
   ✓ GLTF/GLB: ideal para web e Verge3D — excelente
   ✓ FBX: compatível com Blender/3ds Max, preserva UVs e materiais — bom
   ✓ OBJ: amplamente compatível — bom
   ✓ SKP (SketchUp): frequente mas geralmente requer retopologia — médio
   ✓ STEP/STP: precisão de engenharia, bom para referência geométrica — bom
   ✓ DWG/DXF: vetorial 2D, referência técnica — limitado para 3D
   ✓ Outros formatos: avaliar compatibilidade com Blender

2. NOMENCLATURA E VERSIONAMENTO
   ✓ O nome identifica claramente o produto?
   ✓ Há indicação de versão no nome? (v1, v2, final, rev01, etc.)
   ✓ Não é um nome genérico como "arquivo", "novo", "untitled", "modelo1"?

3. COMPLETUDE ESPERADA
   ✓ Para GLTF/GLB: modelo completo com texturas e materiais embutidos?
   ✓ Para FBX/OBJ: espera-se geometria completa, UVs abertas, escala correta?
   ✓ Para STEP/STP: modelo sólido completo, não apenas superfícies?
   ✓ Para DWG/DXF: conjunto completo de vistas com cotas?

4. ADEQUAÇÃO AO FLUXO VERGE3D/BLENDER
   ✓ Formato pode ser importado diretamente no Blender?
   ✓ Provável que tenha geometria separada por tipo de material (facilita UV e texturização)?
   ✓ Adequado para web/real-time rendering (não exige conversão complexa)?`,

    // ── VÍDEOS ────────────────────────────────────────────────────────────────
    videos: `${BASE_CONTEXT}

CATEGORIA: Vídeo de Referência

Vídeos complementam as fotos estáticas — são especialmente úteis para entender:
mecanismos de abertura, movimentos de dobradiças, corrediças, gavetas extensoras,
e detalhes de acabamento que só aparecem em movimento ou sob diferentes ângulos de luz.

Avalie (com base no nome e contexto — análise visual limitada para vídeos):

1. QUALIDADE TÉCNICA ESPERADA
   ✓ Extensão sugere formato compatível? (MP4, MOV, AVI, MKV)
   ✓ Nome indica resolução ou qualidade?
   ✓ Tamanho do arquivo é compatível com vídeo em boa qualidade?

2. CONTEÚDO ESPERADO
   ✓ O nome sugere que é uma demonstração do produto?
   ✓ Há indicação de que mostra mecanismos de abertura/fechamento?
   ✓ Parece complementar as fotos estáticas?

3. UTILIDADE PARA MODELAGEM
   ✓ O vídeo provavelmente mostra detalhes não capturáveis em fotos?
   ✓ Pode ajudar a entender proporções reais do produto em uso?`,

    // ── 3D BLOCK ──────────────────────────────────────────────────────────────
    "3d_block": `${BASE_CONTEXT}

CATEGORIA: Bloco 3D / Modelo de Referência fornecido pelo cliente

Arquivo de modelo 3D enviado pelo cliente como referência ou base de trabalho.
De acordo com os manuais da equipe: "na maioria das vezes o modelo enviado pelo cliente
não tem qualidade suficiente, nem em termos de modelagem 3D quanto de texturas e mapeamento".
A equipe geralmente faz retopologia completa ou modela do zero usando o arquivo como referência.

Avalie com base no nome e formato do arquivo "${fileName}":

1. FORMATO E QUALIDADE ESPERADA
   ✓ GLTF/GLB: formato web moderno, provavelmente inclui texturas — excelente
   ✓ FBX: bom, preserva UVs, materiais, animações — bom
   ✓ OBJ: amplamente compatível, mas materiais separados em .mtl — bom
   ✓ SKP (SketchUp): comum, mas frequentemente requer retopologia completa — médio/baixo
   ✓ STL: só geometria, sem UVs ou materiais — limitado
   ✓ Outros: avaliar compatibilidade

2. NOMENCLATURA
   ✓ O nome identifica o produto claramente?
   ✓ Não é genérico (Cube, Object, untitled, model1)?
   ✓ Indica versão ou revisão?

3. O QUE A EQUIPE PRECISA VERIFICAR
   - Geometria separada por tipo de material (facilita UV e shader)
   - UV aberta e com orientação correta
   - Objeto centralizado na origem da cena
   - Normais orientadas corretamente (faces para fora)
   - Escala real em cm ou m
   - Sem keyframes ou materiais extra desnecessários
   - Modelo LOW POLY ou com possibilidade de simplificação`,

    // ── REFERÊNCIA EXTRA ──────────────────────────────────────────────────────
    extra_reference: `${BASE_CONTEXT}

CATEGORIA: Referência Adicional / Material Complementar

Material de apoio para a produção do customizador 3D.
Pode ser: catálogo do produto, moodboard, ficha técnica, renders do fabricante,
tabela de medidas, especificações de materiais, fotos de ambiente/lifestyle, etc.

Avalie:

1. RELEVÂNCIA PARA PRODUÇÃO
   ✓ O material tem conteúdo útil para a equipe de modelagem ou texturização?
   ✓ Complementa informações não cobertas pelos outros materiais enviados?
   ✓ Tem dimensões, especificações ou detalhes visuais relevantes?

2. QUALIDADE E LEGIBILIDADE
   ✓ Está em boa resolução/qualidade?
   ✓ O conteúdo está legível?
   ✓ Está em português, inglês ou outro idioma acessível à equipe?

3. ORGANIZAÇÃO
   ✓ O arquivo está claramente nomeado?
   ✓ Indica a qual produto ou componente se refere?`,
  };

  return `${prompts[category] || prompts.extra_reference}

---
Arquivo recebido: "${fileName}"

Responda SOMENTE com JSON válido neste formato exato (sem markdown, sem texto fora do JSON):
{
  "score": <inteiro 0-100>,
  "approved": <true se score >= 70, false se menor>,
  "summary": "<1-2 frases em português, objetivas: o que está bom e o que falta>",
  "issues": ["<problema específico e concreto 1>", "<problema 2>"],
  "suggestions": ["<ação corretiva específica 1>", "<ação 2>"],
  "checklist": [
    { "item": "<critério verificado>", "ok": <true/false> }
  ]
}

Regras do score:
- 90-100: material perfeito, equipe trabalha sem dúvidas
- 70-89: aprovado com ressalvas menores
- 50-69: material parcial, equipe pode começar mas precisará de complementos
- 30-49: material insuficiente, requer reenvio de partes importantes
- 0-29: material inutilizável ou completamente inadequado

Se o material for bom, não invente problemas. Issues e suggestions só quando realmente necessário.`;
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileUrl, fileName, category, mimeType } = body;

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
      // ── Imagens: análise visual via Claude Vision ─────────────────────────
      let base64 = "";
      let validMime: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";

      // Claude Vision aceita no máximo ~5MB por imagem (raw bytes antes do base64)
      const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
      let imageFetchedButTooLarge = false;

      try {
        const imgResp = await fetch(fileUrl, {
          headers: { Accept: "image/*" },
        });
        if (imgResp.ok) {
          const buf = await imgResp.arrayBuffer();

          // Determine mime type
          const ct = imgResp.headers.get("content-type") || mimeType || "";
          if (ct.includes("png") || /\.png$/i.test(fileName)) validMime = "image/png";
          else if (ct.includes("webp") || /\.webp$/i.test(fileName)) validMime = "image/webp";
          else if (ct.includes("gif") || /\.gif$/i.test(fileName)) validMime = "image/gif";
          else validMime = "image/jpeg";

          if (buf.byteLength <= MAX_IMAGE_BYTES) {
            base64 = Buffer.from(buf).toString("base64");
          } else {
            // Imagem muito grande para Vision API — análise textual com aviso de tamanho
            const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(1);
            console.warn(`[Analyze] Imagem grande demais para Vision (${sizeMB}MB > 5MB): ${fileName}`);
            imageFetchedButTooLarge = true;
          }
        }
      } catch {
        // fallback below — imagem inacessível
      }

      if (base64) {
        response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages: [
            {
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
            },
          ],
        });
      } else {
        // Imagem muito grande (>5MB) OU inacessível — análise textual
        const nota = imageFetchedButTooLarge
          ? `\n\nNOTA: A imagem foi recebida com sucesso no S3, mas excede 5MB e não pode ser analisada visualmente.
Faça uma avaliação parcial com base apenas no nome do arquivo.
Use score: 55, approved: false, e no summary indique que o arquivo foi recebido mas a resolução excessivamente alta requer
conversão para análise automática. Sugira que o cliente envie uma versão comprimida (máx 3000px no maior lado) para análise automática,
mantendo o arquivo original para uso na produção.`
          : `\n\nNOTA IMPORTANTE: A imagem não pôde ser carregada para análise visual.
Retorne: score: 0, approved: false, issue: "Imagem inacessível — não foi possível realizar análise visual".`;

        response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: buildPrompt(category as AssetCategory, fileName) + nota,
            },
          ],
        });
      }
    } else if (isPdf) {
      // ── PDFs: análise de critérios por categoria, sem leitura do conteúdo ─
      // NOTA: o PDF poderia ser enviado como base64 para o Claude analisar visualmente,
      // mas como o arquivo pode ser grande, optamos por análise dos critérios.
      // A equipe revisará o PDF manualmente.
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content:
              buildPrompt(category as AssetCategory, fileName) +
              `\n\nNOTA: Este é um arquivo PDF. Não é possível ler o conteúdo nesta análise automática.
Retorne uma avaliação parcial com:
- score: 60 (recebido, aguardando revisão manual)
- approved: false (requer confirmação manual da equipe)
- summary: informando que o PDF foi recebido e registrado, mas precisa de revisão manual pela equipe de modelagem
- issues: ["PDF requer revisão manual — análise automática não verifica conteúdo do documento"]
- suggestions: liste as informações específicas que a equipe deve verificar ao abrir o PDF, com base nos critérios da categoria ${category}
- checklist: os critérios como false (não verificados automaticamente)`,
          },
        ],
      });
    } else {
      // ── Outros (CAD, FBX, vídeo, etc.) — análise por nome e extensão ─────
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content:
              buildPrompt(category as AssetCategory, fileName) +
              `\n\nNOTA: Este arquivo é do tipo "${mimeType || "desconhecido"}".
Não é possível abrir o arquivo nesta análise — avalie exclusivamente com base no nome e extensão do arquivo.
Seja realista: um arquivo com nome descritivo e formato correto merece score mais alto;
um arquivo com nome genérico ("arquivo1.skp", "untitled.obj") merece penalização.`,
          },
        ],
      });
    }

    // ─── Parse da resposta ────────────────────────────────────────────────────
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Resposta inesperada do Claude");
    }

    // Extrai JSON — pode vir com ou sem markdown
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Claude não retornou JSON válido. Resposta: ${content.text.slice(0, 200)}`);
    }

    const result: AnalysisResult = JSON.parse(jsonMatch[0]);

    // Garante campos obrigatórios
    if (typeof result.score !== "number") result.score = 50;
    if (typeof result.approved !== "boolean") result.approved = result.score >= 70;
    if (!Array.isArray(result.issues)) result.issues = [];
    if (!Array.isArray(result.suggestions)) result.suggestions = [];
    if (!Array.isArray(result.checklist)) result.checklist = [];

    return NextResponse.json({
      score: result.score,
      approved: result.approved,
      summary: result.summary || "",
      issues: result.issues,
      suggestions: result.suggestions,
      checklist: result.checklist,
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

/**
 * Agente: Monk Lighthouse — Auditor de Qualidade dos Customizadores
 *
 * Para cada bloco publicado, faz GET no index.html, parseia indicadores
 * de qualidade (analytics script, downloads corretos, escala, AR), e envia
 * tudo pro Claude pra analisar e priorizar problemas.
 */
import { NextRequest, NextResponse } from "next/server";
import { scanAll, TABLES } from "@/lib/dynamo";
import { callClaudeWithRetry } from "@/lib/claude-retry";
import { ATT_CONTEXT } from "@/lib/agent-context";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é **Monk Lighthouse** (referência: Adrian Monk + Google Lighthouse), auditor obsessivo de QUALIDADE dos customizadores 3D publicados.

${ATT_CONTEXT}

## Sua função (específica do Monk)
Você NÃO audita dados do portal (isso é trabalho do Sherlock Codes). Você audita
SOMENTE os customizadores publicados — testando se cada um funciona como deveria
para o cliente final (arquiteto, designer).

O probe já coletou os dados via fetch direto nas URLs. Confie nos campos:
- \`hasAnalytics\` → true se index.html tem \`enviarEventoCustomizador\`/\`register-event\`/\`odwlqrkix5\`
  (ATENÇÃO: NÃO mencione GA4, gtag ou Google Analytics — não usamos)
- \`scalingDisabled\` → true se meta viewport tem \`user-scalable=no\` E \`maximum-scale=1.0\`
- \`hasARButton\` + \`hasUsdz\` → AR funcional iOS+Android
- \`downloads[].matchesProduct\` → false significa link de SketchUp/Archicad/Revit
  apontando para produto errado (ex: customizador WJ com link de Jader)

## O que reportar
- **Downloads incorretos**: matchesProduct=false → link errado, alta prioridade
- **Tracking ausente**: hasAnalytics=false → cliente perderá métricas no portal
- **Escala/zoom permitido**: scalingDisabled=false → no AR pode escalar móvel (errado, móvel real não muda de tamanho)
- **HTTP erros**: status != 200
- **AR quebrada**: hasUsdz=false ou hasARButton=false → iOS/Android não terão AR
- **ui.js inacessível**: probe não conseguiu validar downloads

## Formato (markdown CURTO)
**Resumo** (2-3 linhas, com totais)
**Problemas críticos** (max 10, formato: "[N] [Cliente · Produto] Problema · Como corrigir tecnicamente")
**Por cliente** (uma linha: cliente → produtos OK/total · alertas)
**Top 5 ações priorizadas**

Seja DIRETO. Use nomes reais. Cite IDs/URLs. Não invente. Quando o probe não cobrir
algo (ex: comportamento WebXR ao escalar), fale "não verificável via probe (requer teste visual)".`;

interface ProbeResult {
  blockId: string;
  client: string;
  product: string;
  url: string;
  httpStatus: number;
  title?: string;
  hasAnalytics: boolean;
  hasARButton: boolean;
  hasUsdz: boolean;
  scalingDisabled: boolean; // viewport user-scalable=no
  downloads: { type: string; url: string; matchesProduct: boolean }[];
  zoomUiPresent: boolean;
  errors: string[];
}

interface MonkRequest {
  prompt?: string;
  clientId?: string; // opcional para filtrar por 1 cliente
  url?: string; // opcional: auditar URL específica (ignora filtros e DB)
  urls?: string[]; // opcional: lista de URLs específicas (máx 10)
}

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    return { status: res.status, text };
  } catch (e) {
    return { status: 0, text: `ERR: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

function probeHtml(html: string): Omit<ProbeResult, "blockId" | "client" | "product" | "url" | "httpStatus" | "downloads"> {
  const errors: string[] = [];
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim();
  // Tracking ATT: enviarEventoCustomizador / register-event / API Gateway odwlqrkix5
  const hasAnalytics = /enviarEventoCustomizador|register-event|odwlqrkix5\.execute-api|EVENT_ENDPOINT/i.test(html);
  const hasARButton = /enter_AR_button|xrButton|webxr/i.test(html);
  const hasUsdz = /\.usdz/i.test(html);
  // viewport tag user-scalable
  const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i);
  const viewport = viewportMatch?.[0] || "";
  const scalingDisabled = /user-scalable\s*=\s*no/i.test(viewport) && /maximum-scale\s*=\s*1/i.test(viewport);
  // UI zoom button (Verge3D template — flag para revisar visualmente)
  const zoomUiPresent = /Zoom In\/Out|zoom\.png|enableZoom/i.test(html);
  return { title, hasAnalytics, hasARButton, hasUsdz, scalingDisabled, zoomUiPresent, errors };
}

/** Lê o ui.js (fonte real dos downloads) e extrai os 3 links. */
function probeUiJs(js: string): { sketchup?: string; archicad?: string; revit?: string } {
  const out: { sketchup?: string; archicad?: string; revit?: string } = {};
  const sk = js.match(/['"]sketchup['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (sk) out.sketchup = sk[1];
  const ar = js.match(/['"]archicad['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (ar) out.archicad = ar[1];
  const rv = js.match(/['"]revit['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (rv) out.revit = rv[1];
  return out;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY ausente" }, { status: 500 });

    const body: MonkRequest = await req.json().catch(() => ({}));

    // Modo "URL específica": pula DynamoDB e audita só o que veio
    let sample: Array<{ blockId: string; url: string; _adhoc?: boolean }> = [];
    let clientById: Record<string, Record<string, unknown>> = {};
    let blockById: Record<string, Record<string, unknown>> = {};

    const adhocUrls = body.url ? [body.url] : (body.urls || []);
    if (adhocUrls.length > 0) {
      sample = adhocUrls.slice(0, 10).map((u, i) => ({ blockId: `adhoc_${i}`, url: u, _adhoc: true }));
    } else {
      type Row = Record<string, unknown>;
      const [clients, blocks, publications] = await Promise.all([
        scanAll<Row>(TABLES.CLIENTS),
        scanAll<Row>(TABLES.BLOCKS),
        scanAll<Row>(TABLES.PUBLICATIONS),
      ]);
      clientById = Object.fromEntries(clients.map((c) => [String(c.id), c]));
      blockById = Object.fromEntries(blocks.map((b) => [String(b.id), b]));

      let pubsToCheck = publications;
      if (body.clientId) {
        const wantedIds = new Set(blocks.filter((b) => b.clientId === body.clientId).map((b) => String(b.id)));
        pubsToCheck = publications.filter((p) => wantedIds.has(String(p.blockId)));
      }
      // Limite menor (10) para caber no Lambda 30s
      sample = pubsToCheck.slice(0, 10).map((p) => ({ blockId: String(p.blockId), url: String(p.url || "") }));
    }

    // Probe em paralelo (com timeout por URL)
    const probes: ProbeResult[] = await Promise.all(
      sample.map(async (pub) => {
        const block = blockById[pub.blockId];
        const client = block ? clientById[String(block.clientId)] : undefined;
        const url = pub.url;
        // Em modo ad-hoc, tenta inferir cliente/produto pela URL
        const slugFromUrl = url.match(/explorar\.archtechtour\.com\/([^/]+)\/ver-\d+\/([^/]+)/i);
        const clientName = client?.name ? String(client.name) : (pub._adhoc && slugFromUrl ? slugFromUrl[1] : "?");
        const productTitle = block?.title ? String(block.title) : (pub._adhoc && slugFromUrl ? slugFromUrl[2].replace(/-/g, " ") : "?");
        const clientCode = client?.code ? String(client.code).toLowerCase() : (pub._adhoc && slugFromUrl ? slugFromUrl[1] : "");

        if (!url) return { blockId: pub.blockId, client: clientName, product: productTitle, url, httpStatus: 0, hasAnalytics: false, hasARButton: false, hasUsdz: false, scalingDisabled: false, downloads: [], zoomUiPresent: false, errors: ["URL ausente"] };

        const { status, text } = await fetchWithTimeout(url);
        if (status !== 200) {
          return { blockId: pub.blockId, client: clientName, product: productTitle, url, httpStatus: status, hasAnalytics: false, hasARButton: false, hasUsdz: false, scalingDisabled: false, downloads: [], zoomUiPresent: false, errors: [`HTTP ${status}`] };
        }
        const p = probeHtml(text);

        // Busca o ui.js (fonte real dos links de download)
        const uiUrl = url.replace(/index\.html?$/i, "ui.js");
        const { status: uiStatus, text: uiText } = await fetchWithTimeout(uiUrl);
        const dlObj = uiStatus === 200 ? probeUiJs(uiText) : {};
        const errors = [...p.errors];
        if (uiStatus !== 200) errors.push(`ui.js HTTP ${uiStatus} — não foi possível verificar downloads reais`);

        // Heurística: a URL de download deve conter parte do nome do produto (slug do title)
        const productSlugFragments = productTitle
          .toLowerCase()
          .normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .split(/\s+/)
          .filter((w) => w.length >= 3);

        const downloads = (["sketchup", "archicad", "revit"] as const).flatMap((type) => {
          const dl = dlObj[type];
          if (!dl) return [];
          const dlLower = dl.toLowerCase();
          // matchesProduct: tem que ter ao menos um fragmento do título do produto OU o code do cliente
          const matchesByProduct = productSlugFragments.some((f) => dlLower.includes(f));
          const matchesByClient = clientCode ? dlLower.includes(clientCode) || dlLower.includes(clientCode.replace(/-/g, "")) : false;
          return [{ type, url: dl, matchesProduct: matchesByProduct || matchesByClient }];
        });

        return {
          blockId: pub.blockId,
          client: clientName,
          product: productTitle,
          url,
          httpStatus: status,
          title: p.title,
          hasAnalytics: p.hasAnalytics,
          hasARButton: p.hasARButton,
          hasUsdz: p.hasUsdz,
          scalingDisabled: p.scalingDisabled,
          downloads,
          zoomUiPresent: p.zoomUiPresent,
          errors,
        };
      })
    );

    // Resumo agregado
    const summary = {
      total: probes.length,
      byClient: probes.reduce<Record<string, { total: number; ok: number; problems: number }>>((acc, p) => {
        const c = p.client || "?";
        if (!acc[c]) acc[c] = { total: 0, ok: 0, problems: 0 };
        acc[c].total++;
        const hasProblem = p.httpStatus !== 200 || !p.hasAnalytics || !p.scalingDisabled || p.downloads.some((d) => !d.matchesProduct) || p.errors.length > 0;
        if (hasProblem) acc[c].problems++; else acc[c].ok++;
        return acc;
      }, {}),
      analyticsMissing: probes.filter((p) => p.httpStatus === 200 && !p.hasAnalytics).map((p) => `${p.client}/${p.product}`),
      downloadMismatches: probes.filter((p) => p.downloads.some((d) => !d.matchesProduct)).map((p) => ({
        produto: `${p.client}/${p.product}`,
        downloads_errados: p.downloads.filter((d) => !d.matchesProduct).map((d) => d.url),
      })),
      scalingAllowed: probes.filter((p) => p.httpStatus === 200 && !p.scalingDisabled).map((p) => `${p.client}/${p.product}`),
      httpErrors: probes.filter((p) => p.httpStatus !== 200).map((p) => ({ produto: `${p.client}/${p.product}`, status: p.httpStatus, url: p.url })),
      noUsdz: probes.filter((p) => p.httpStatus === 200 && !p.hasUsdz).map((p) => `${p.client}/${p.product}`),
    };

    const userPrompt = body.prompt
      ? `${body.prompt}\n\n---\nRESULTADO DO PROBE (${probes.length} customizadores):\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``
      : `Audite a qualidade dos ${probes.length} customizadores publicados.\n\nResumo agregado:\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``;

    const { text, usage, modelUsed, attempts } = await callClaudeWithRetry({
      apiKey, primaryModel: "claude-haiku-4-5", fallbackModel: "claude-sonnet-4-5",
      system: SYSTEM_PROMPT, userPrompt, maxTokens: 2048,
    });

    return NextResponse.json({
      ok: true,
      report: text,
      probes_count: probes.length,
      summary: { byClient: summary.byClient, problems: summary.downloadMismatches.length + summary.analyticsMissing.length + summary.scalingAllowed.length + summary.httpErrors.length },
      timestamp: new Date().toISOString(),
      tokens: { input: usage.input_tokens, output: usage.output_tokens },
      model: modelUsed,
      attempts,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("Monk Lighthouse error:", e);
    return NextResponse.json({
      error: (e as Error).message || "Erro desconhecido na auditoria de qualidade",
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }
}

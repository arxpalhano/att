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

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é Monk Lighthouse, auditor obsessivo de qualidade dos customizadores 3D da ArchTechTour (referência: Adrian Monk + Google Lighthouse).

Cada cliente da ATT tem produtos publicados em URLs no padrão:
https://explorar.archtechtour.com/{cliente-slug}/ver-N/{produto-slug}/index.html

Os links REAIS de download (SketchUp/Archicad/Revit) NÃO ficam no index.html (que tem placeholder hardcoded de template), e sim no arquivo \`ui.js\` ao lado do index.html. O probe já buscou em ui.js — confie nos dados de "downloads" do JSON.

Sua missão: analisar os RESULTADOS DO PROBE (já coletados) e apontar problemas.

Verifique especialmente:
- **Downloads incorretos**: link com matchesProduct=false → URL não contém o slug do cliente nem fragmentos do nome do produto → muito provável que esteja apontando para produto/cliente errado
- **Analytics ausente**: customizador sem script de tracking
- **Escala/zoom permitido**: scalingDisabled=false → viewport sem user-scalable=no
- **HTTP erros**: páginas que não retornam 200
- **AR quebrada**: hasUsdz=false ou hasARButton=false
- **ui.js inacessível**: download links não foram coletados (errors menciona "ui.js HTTP ...")

Formato (markdown CURTO):
**Resumo** (2-3 linhas)
**Problemas críticos** (max 10, formato: "[N] [Cliente · Produto] Problema · Como corrigir")
**Por cliente** (uma linha: cliente → produtos OK/total · alertas)
**Top 5 ações priorizadas**

Seja DIRETO. Use nomes reais. Não invente. Quando o probe não tiver dado, fale "não verificável (limitação técnica)".`;

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
  const hasAnalytics = /RegistrarEvento|customizador-events|archtechtour-events/i.test(html);
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

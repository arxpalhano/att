/**
 * Agente: Monk Lighthouse — Auditor de Qualidade dos Customizadores
 *
 * Para cada bloco publicado, faz GET no index.html, parseia indicadores
 * de qualidade (analytics script, downloads corretos, escala, AR), e envia
 * tudo pro Claude pra analisar e priorizar problemas.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { scanAll, TABLES } from "@/lib/dynamo";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é Monk Lighthouse, auditor obsessivo de qualidade dos customizadores 3D da ArchTechTour (referência: Adrian Monk + Google Lighthouse).

Cada cliente da ATT tem produtos publicados em URLs no padrão:
https://explorar.archtechtour.com/{cliente-slug}/ver-N/{produto-slug}/index.html

Sua missão: analisar os RESULTADOS DO PROBE (já coletados) e apontar problemas.

Verifique especialmente:
- **Downloads incorretos**: link de SketchUp/Revit/Archicad apontando para produto de OUTRO cliente (ex: customizador WJ com download de Jader)
- **Analytics ausente**: customizador sem script de tracking (RegistrarEvento/customizador-events)
- **Escala/zoom permitido**: viewport sem user-scalable=no OU presença de controles de zoom no AR/WebXR
- **HTTP erros**: páginas que não retornam 200
- **AR quebrada**: faltam links USDZ ou enter_AR_button
- **Inconsistências**: nome no <title> diferente do produto esperado

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
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<{ status: number; text: string }> {
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

function probe(html: string): Omit<ProbeResult, "blockId" | "client" | "product" | "url" | "httpStatus" | "downloads"> & { downloadHrefs: string[] } {
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
  // UI zoom button (Verge3D template includes it by default — flag para revisar)
  const zoomUiPresent = /Zoom In\/Out|zoom\.png|enableZoom/i.test(html);
  // Extract download links
  const downloadHrefs: string[] = [];
  const regex = /<a[^>]*\bid=["'](sketchup-model|archicad-model|revit-model)["'][^>]*\bhref=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) { downloadHrefs.push(`${m[1]}::${m[2]}`); }
  // Also catch download="" href="..." with .zip extension
  if (downloadHrefs.length === 0) {
    const altRegex = /href=["']([^"']*\.(zip|usdz|skp|rvt|gsm))["']/gi;
    while ((m = altRegex.exec(html)) !== null) downloadHrefs.push(`other::${m[1]}`);
  }
  return { title, hasAnalytics, hasARButton, hasUsdz, scalingDisabled, zoomUiPresent, errors, downloadHrefs };
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY ausente" }, { status: 500 });

    const body: MonkRequest = await req.json().catch(() => ({}));

    type Row = Record<string, unknown>;
    const [clients, blocks, publications] = await Promise.all([
      scanAll<Row>(TABLES.CLIENTS),
      scanAll<Row>(TABLES.BLOCKS),
      scanAll<Row>(TABLES.PUBLICATIONS),
    ]);

    const clientById = Object.fromEntries(clients.map((c) => [String(c.id), c]));
    const blockById = Object.fromEntries(blocks.map((b) => [String(b.id), b]));

    // Filtra publicações por cliente se fornecido
    let pubsToCheck = publications;
    if (body.clientId) {
      const wantedIds = new Set(blocks.filter((b) => b.clientId === body.clientId).map((b) => String(b.id)));
      pubsToCheck = publications.filter((p) => wantedIds.has(String(p.blockId)));
    }

    // Limita a 25 customizadores por auditoria (timeout Lambda)
    const sample = pubsToCheck.slice(0, 25);

    // Probe em paralelo (com timeout por URL)
    const probes: ProbeResult[] = await Promise.all(
      sample.map(async (pub) => {
        const block = blockById[String(pub.blockId)];
        const client = block ? clientById[String(block.clientId)] : undefined;
        const url = String(pub.url || "");
        const clientName = client?.name ? String(client.name) : "?";
        const productTitle = block?.title ? String(block.title) : "?";
        const clientCode = client?.code ? String(client.code).toLowerCase() : "";

        if (!url) return { blockId: String(pub.blockId), client: clientName, product: productTitle, url, httpStatus: 0, hasAnalytics: false, hasARButton: false, hasUsdz: false, scalingDisabled: false, downloads: [], zoomUiPresent: false, errors: ["URL ausente"] };

        const { status, text } = await fetchWithTimeout(url);
        if (status !== 200) {
          return { blockId: String(pub.blockId), client: clientName, product: productTitle, url, httpStatus: status, hasAnalytics: false, hasARButton: false, hasUsdz: false, scalingDisabled: false, downloads: [], zoomUiPresent: false, errors: [`HTTP ${status}`] };
        }
        const p = probe(text);
        // Verifica se cada download URL contém o slug do cliente (heurística simples)
        const downloads = p.downloadHrefs.map((entry) => {
          const [type, dl] = entry.split("::");
          const dlLower = dl.toLowerCase();
          const matchesProduct = clientCode ? dlLower.includes(clientCode) || dlLower.includes(clientCode.replace(/-/g, "")) : false;
          return { type, url: dl, matchesProduct };
        });
        return {
          blockId: String(pub.blockId),
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
          errors: p.errors,
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

    const ai = new Anthropic({ apiKey });
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({
      ok: true,
      report: text,
      probes_count: probes.length,
      summary: { byClient: summary.byClient, problems: summary.downloadMismatches.length + summary.analyticsMissing.length + summary.scalingAllowed.length + summary.httpErrors.length },
      timestamp: new Date().toISOString(),
      tokens: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
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

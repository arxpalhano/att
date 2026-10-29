/**
 * "No site do cliente" — verificação automática pelo analytics (src/lib/client-sites.ts).
 *
 * GET  → último relatório (ou { report: null }). Usuário de cliente recebe só as
 *        publicações da própria marca, sem os domínios sugeridos.
 * POST → roda a verificação no Athena (~10–30 s) e grava o relatório.
 *        ?auto=1: só roda se o relatório tiver mais de CLIENT_SITES_MAX_AGE_H horas
 *        (a tela chama assim ao abrir, e o primeiro do dia dispara a verificação).
 * POST ?step=pages → procura um lote (~20 s) das PÁGINAS dos produtos nos sites das marcas
 *        (sitemap + link do customizador no HTML). Devolve { remaining }: a tela chama de
 *        novo enquanto houver. O GET devolve `pages` (id da publicação → página).
 */
import { NextRequest, NextResponse } from "next/server";
import { readActor, writeActivities } from "@/lib/activity-server";
import { readClientPages, readClientSitesReport, runClientPagesBatch, runClientSitesCheck } from "@/lib/client-sites-server";
import { CLIENT_SITES_MAX_AGE_H, ClientPagesStore, ClientSiteReport } from "@/lib/client-sites";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pagesFor(store: ClientPagesStore | null, role: string, clientId?: string) {
  if (!store) return {};
  if (role !== "client") return store.pages;
  return Object.fromEntries(Object.entries(store.pages).filter(([, e]) => e.clientId === clientId));
}

function forActor(report: ClientSiteReport | null, role: string, clientId?: string) {
  if (!report || role !== "client") return report;
  const hits = Object.fromEntries(Object.entries(report.hits).filter(([, h]) => h.clientId === clientId));
  return { ...report, hits, unknownHosts: {} };
}

export async function GET(req: NextRequest) {
  try {
    const { actor } = await readActor(req);
    const [report, pages] = await Promise.all([readClientSitesReport(), readClientPages().catch(() => null)]);
    return NextResponse.json({ report: forActor(report, actor.role, actor.clientId), pages: pagesFor(pages, actor.role, actor.clientId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { actor, sessionEmail } = await readActor(req);
    if (actor.id === "anon") return NextResponse.json({ error: "sem usuário" }, { status: 401 });
    if (actor.role === "client" || actor.role === "freelancer_bim") return NextResponse.json({ error: "sem acesso" }, { status: 403 });
    if (req.nextUrl.searchParams.get("step") === "pages") {
      const r = await runClientPagesBatch(20000);
      const store = await readClientPages();
      return NextResponse.json({ ok: true, ...r, pages: store?.pages ?? {} });
    }
    const auto = req.nextUrl.searchParams.get("auto") === "1";
    const prev = await readClientSitesReport();
    if (auto && prev && Date.now() - Date.parse(prev.checkedAt) < CLIENT_SITES_MAX_AGE_H * 3600_000) {
      return NextResponse.json({ ok: true, skipped: true, report: prev });
    }
    const report = await runClientSitesCheck(auto ? "automático" : actor.name);
    const novos = Object.keys(report.hits).filter((id) => !prev?.hits[id]);
    if (!auto || novos.length) {
      await writeActivities([{
        type: "client_sites_check", entity: "publications", blockId: "",
        desc: `Verificação "no site do cliente" pelo analytics: ${Object.keys(report.hits).length} publicação(ões) no ar nos sites das marcas${novos.length && prev ? `, ${novos.length} nova(s) desde a última` : ""} · ${(report.ms / 1000).toFixed(1)}s`,
      }], actor, sessionEmail, "server").catch(() => undefined);
    }
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

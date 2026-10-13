/**
 * Páginas públicas em rascunho (site, planos, contrato, ATT Instant) escondidas
 * atrás de um link de prévia — desde 2026-10-13.
 *
 * Só o /portal está em produção. A home (`/`), `/planos`, `/contrato` e
 * `/experimentar` ainda estão sendo decididas e não podem aparecer para cliente:
 * quem cair nelas é mandado para o /portal.
 *
 * Para a equipe ver o rascunho: abrir uma vez
 *   https://app.archtechtour.com/?preview=<LANDING_PREVIEW_KEY>
 * — grava um cookie por 30 dias nesse navegador e as páginas passam a abrir.
 * `?preview=off` apaga o cookie. As páginas em prévia saem com `noindex` para
 * o Google não indexar o rascunho. Para liberar uma página de vez, basta tirar
 * a rota do `matcher` abaixo.
 */
import { NextRequest, NextResponse } from "next/server";

const COOKIE = "att_preview";
const KEY = process.env.LANDING_PREVIEW_KEY || "att-rascunho-2026";
const DAYS = 30;

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const param = url.searchParams.get("preview");

  if (param === "off") {
    const res = NextResponse.redirect(new URL("/portal", url));
    res.cookies.delete(COOKIE);
    return res;
  }
  if (param && param === KEY) {
    // Entra em modo prévia e volta para a mesma página sem o parâmetro na URL.
    const clean = url.clone(); clean.searchParams.delete("preview");
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, KEY, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DAYS * 86400 });
    return res;
  }
  if (req.cookies.get(COOKIE)?.value === KEY) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  return NextResponse.redirect(new URL("/portal", url), 307);
}

export const config = {
  matcher: ["/", "/planos/:path*", "/contrato/:path*", "/experimentar/:path*"],
};

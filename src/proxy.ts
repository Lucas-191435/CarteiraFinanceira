import { NextResponse, type NextRequest } from "next/server";
import { AUTH_PAGES, PRIVATE_PREFIXES, PrivateRoutes, PublicRoutes } from "@/constants/routes";
import { SESSION_COOKIE } from "@/constants/session";

/**
 * Checagem otimista: só olha se o cookie existe, sem chamar a API, para redirecionar rápido.
 * Quem garante a sessão de verdade é o layout privado (requireUser → GET /user/me).
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname, search } = request.nextUrl;

  // Não há landing: a raiz leva direto para o login ou para a carteira
  if (pathname === PublicRoutes.home) {
    return NextResponse.redirect(new URL(hasSession ? PrivateRoutes.wallet : PublicRoutes.login, request.url));
  }

  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isPrivate && !hasSession) {
    const loginUrl = new URL(PublicRoutes.login, request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL(PrivateRoutes.wallet, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Fora: assets do Next, ícone e /sair (que apaga o cookie e não pode ser redirecionado de volta)
  matcher: ["/((?!_next/static|_next/image|icon.png|sair).*)"],
};

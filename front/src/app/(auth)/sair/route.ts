import { NextResponse, type NextRequest } from "next/server";
import { PublicRoutes } from "@/constants/routes";
import { deleteSession } from "@/lib/session";

// Destino do layout privado quando a sessão é inválida: Server Components não podem apagar
// cookies, então o redirect passa por aqui. (O botão "Sair" usa a logoutAction.)
export async function GET(request: NextRequest) {
  await deleteSession();

  const loginUrl = new URL(PublicRoutes.login, request.url);
  if (request.nextUrl.searchParams.has("expirada")) {
    loginUrl.searchParams.set("expirada", "1");
  }
  return NextResponse.redirect(loginUrl);
}

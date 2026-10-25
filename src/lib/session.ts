import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/constants/session";

// Secure só quando o front é servido por HTTPS. Não usar NODE_ENV: no Docker local o Next roda
// em modo produção acessado por http://, e um cookie Secure seria descartado pelo navegador.
const secure = process.env.APP_URL?.startsWith("https://") ?? false;

/** Lê o `exp` do JWT (sem validar — quem valida é a API) para o cookie expirar junto com o token. */
function tokenExpiry(token: string): Date | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : undefined;
  } catch {
    return undefined;
  }
}

/** Grava o token da API em cookie httpOnly. Só funciona em Server Actions e Route Handlers. */
export async function createSession(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: tokenExpiry(token),
  });
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

/** Só funciona em Server Actions e Route Handlers. */
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

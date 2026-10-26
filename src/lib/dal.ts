import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import { PublicRoutes } from "@/constants/routes";
import type { IUser } from "@/types/IUser";
import type { IStatement, IWallet } from "@/types/IWallet";
import { ApiError, apiFetch } from "./api";
import { getSessionToken } from "./session";

// Camada de acesso a dados: toda leitura autenticada passa por aqui.
//
// "use cache: private": o resultado fica no Client Cache do navegador desta pessoa (nunca num cache
// compartilhado do servidor) e pode ler o cookie da sessão. Dentro do prazo (stale), voltar a uma
// tela, página ou mês já visto não faz request nenhum. Também deduplica dentro da requisição.
// Invalidação: as Server Actions chamam updateTag(...) depois de escrever; login/logout trocam o
// cookie, o que já descarta o cache.

/** Prazo de reaproveitamento no navegador. 5 min também é o mínimo para entrar no App Shell da rota. */
const CLIENT_STALE_SECONDS = 300;

export const CacheTags = {
  session: "session",
  wallet: "wallet",
} as const;

/** Usuário da sessão atual, ou null se não houver sessão válida. */
export async function getCurrentUser(): Promise<IUser | null> {
  "use cache: private";
  cacheLife({ stale: CLIENT_STALE_SECONDS });
  cacheTag(CacheTags.session);

  if (!(await getSessionToken())) {
    return null;
  }

  try {
    return await apiFetch<IUser>("/user/me");
  } catch (error) {
    // 401: token expirado/inválido; 404: usuário não existe mais
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

/**
 * Usuário da sessão ou redirect. Vai para /sair (e não direto para /login) porque o cookie
 * inválido precisa ser apagado, e Server Components não podem apagar cookies.
 */
export async function requireUser(): Promise<IUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`${PublicRoutes.logout}?expirada=1`);
  }
  return user;
}

export async function getWallet(): Promise<IWallet> {
  "use cache: private";
  cacheLife({ stale: CLIENT_STALE_SECONDS });
  cacheTag(CacheTags.wallet);

  return apiFetch<IWallet>("/wallet");
}

/** Os argumentos entram na chave do cache: cada página/mês é uma entrada separada. */
export async function getStatement(page: number, pageSize: number, from?: string, to?: string): Promise<IStatement> {
  "use cache: private";
  cacheLife({ stale: CLIENT_STALE_SECONDS });
  cacheTag(CacheTags.wallet);

  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return apiFetch<IStatement>(`/wallet/statement?${query}`);
}

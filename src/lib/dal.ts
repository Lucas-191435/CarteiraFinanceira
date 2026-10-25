import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { PublicRoutes } from "@/constants/routes";
import type { IUser } from "@/types/IUser";
import type { IStatement, IWallet } from "@/types/IWallet";
import { ApiError, apiFetch } from "./api";
import { getSessionToken } from "./session";

// Camada de acesso a dados: toda leitura autenticada passa por aqui.
// cache() do React deduplica dentro da mesma requisição (layout + página = 1 chamada à API).

/** Usuário da sessão atual, ou null se não houver sessão válida. */
export const getCurrentUser = cache(async (): Promise<IUser | null> => {
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
});

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

export const getWallet = cache(() => apiFetch<IWallet>("/wallet"));

// Argumentos primitivos: o cache() do React compara por referência, e um objeto nunca deduplicaria
export const getStatement = cache((page: number, pageSize: number, from?: string, to?: string) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return apiFetch<IStatement>(`/wallet/statement?${query}`);
});

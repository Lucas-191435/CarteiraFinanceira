export const PublicRoutes = {
  home: "/",
  login: "/login",
  signup: "/cadastro",
  logout: "/sair",
} as const;

export const PrivateRoutes = {
  wallet: "/carteira",
  statement: "/carteira/extrato",
} as const;

/** Prefixos que exigem sessão (usados pelo proxy.ts). */
export const PRIVATE_PREFIXES = [PrivateRoutes.wallet];

/** Páginas que só fazem sentido deslogado. */
export const AUTH_PAGES: string[] = [PublicRoutes.login, PublicRoutes.signup];

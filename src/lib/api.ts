import "server-only";
import { getSessionToken } from "./session";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchInit = Omit<RequestInit, "body"> & {
  /** Envia o token da sessão (padrão: true). */
  auth?: boolean;
  /** Serializado como JSON. */
  body?: unknown;
};

/**
 * Chama a API a partir do servidor Next (Server Components, Server Actions, Route Handlers).
 * O token sai do cookie httpOnly e nunca passa pelo browser.
 */
export async function apiFetch<T>(path: string, { auth = true, body, headers, ...init }: ApiFetchInit = {}): Promise<T> {
  const baseUrl = process.env.API_URL;
  if (!baseUrl) {
    throw new Error("API_URL não definida no ambiente do front");
  }

  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = await getSessionToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  // Sem cache: com cacheComponents, fetch é dinâmico por padrão — e saldo/usuário nunca devem ser cacheados
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    // class-validator devolve message como array; o resto da API, como string
    const message = Array.isArray(data?.message) ? data.message[0] : (data?.message ?? response.statusText);
    throw new ApiError(response.status, String(message));
  }

  return data as T;
}

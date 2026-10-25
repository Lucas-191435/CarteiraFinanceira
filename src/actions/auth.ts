"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PrivateRoutes, PublicRoutes } from "@/constants/routes";
import { ApiError, apiFetch } from "@/lib/api";
import { createSession, deleteSession } from "@/lib/session";
import type { ActionState } from "@/types/action";
import type { ILoginResponse } from "@/types/IUser";
import { loginSchema, signupSchema } from "@/validations/auth";

const GENERIC_ERROR = "Não foi possível concluir agora. Tente novamente em instantes.";

/** Só aceita caminhos internos (evita open redirect via ?next=https://...). */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : PrivateRoutes.wallet;
}

async function requestToken(email: string, password: string) {
  const { token } = await apiFetch<ILoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  return token;
}

function rateLimited(error: unknown) {
  return error instanceof ApiError && error.status === 429;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  let token: string;
  try {
    token = await requestToken(parsed.data.email, parsed.data.password);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Genérico de propósito: não revela se o e-mail existe
      return { ok: false, message: "E-mail ou senha incorretos" };
    }
    if (rateLimited(error)) {
      return { ok: false, message: "Muitas tentativas. Aguarde um minuto e tente de novo." };
    }
    console.error("[loginAction]", error);
    return { ok: false, message: GENERIC_ERROR };
  }

  await createSession(token);
  redirect(safeNext(formData.get("next")));
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { name, email, password } = parsed.data;

  // Sem verificação de e-mail: a API cria usuário e carteira na hora
  try {
    await apiFetch("/user", { method: "POST", auth: false, body: { name, email, password } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { ok: false, fieldErrors: { email: ["Este e-mail já está cadastrado"] } };
    }
    if (rateLimited(error)) {
      return { ok: false, message: "Muitas tentativas. Aguarde um minuto e tente de novo." };
    }
    console.error("[signupAction]", error);
    return { ok: false, message: GENERIC_ERROR };
  }

  // Login automático; se falhar (raro), a conta já existe e o usuário entra pela tela de login
  let token: string;
  try {
    token = await requestToken(email, password);
  } catch (error) {
    console.error("[signupAction] login automático falhou", error);
    redirect(`${PublicRoutes.login}?email=${encodeURIComponent(email)}&criada=1`);
  }

  await createSession(token);
  redirect(PrivateRoutes.wallet);
}

export async function logoutAction() {
  // A API não tem logout (JWT stateless): apagar o cookie encerra a sessão neste navegador
  await deleteSession();
  redirect(PublicRoutes.login);
}

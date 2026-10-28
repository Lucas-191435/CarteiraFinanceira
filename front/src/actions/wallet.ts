"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SIMULATE_STATUS_FIELD, SIMULATED_STATUSES } from "@/constants/error-simulator";
import { PublicRoutes } from "@/constants/routes";
import { ApiError, apiFetch } from "@/lib/api";
import { CacheTags } from "@/lib/dal";
import { errorSimulatorEnabled } from "@/lib/error-simulator";
import { brl } from "@/lib/format";
import { parseAmount } from "@/lib/money";
import type { ActionState } from "@/types/action";
import type { IRecipient } from "@/types/IUser";
import type { ITransaction } from "@/types/IWallet";
import { depositSchema, reverseSchema, transferSchema } from "@/validations/wallet";

// Toda action revalida no servidor (o client nunca é confiável) e a autorização vem do cookie.
// Sucesso → walletChanged(): expira o cache de saldo e extrato e devolve a tela atual atualizada.

const GENERIC_ERROR = "Não foi possível concluir agora. Tente novamente.";

/**
 * Saldo/extrato mudaram: updateTag expira o cache (todas as páginas e meses; a próxima leitura espera
 * o dado novo, sem servir o antigo) e refresh() devolve a tela atual já atualizada na mesma resposta.
 */
function walletChanged() {
  updateTag(CacheTags.wallet);
  refresh();
}

type ErrorMessages = Partial<Record<number, { message?: string; field?: string }>>;

/** Traduz um erro da API em ActionState pelo status (nunca pelo texto da API). */
function toActionError(error: unknown, messages: ErrorMessages, context: string): ActionState<never> {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      // Sessão expirou no meio do uso: /sair apaga o cookie e manda para o login
      redirect(`${PublicRoutes.logout}?expirada=1`);
    }
    if (error.status === 429) {
      return { ok: false, message: "Muitas tentativas. Aguarde um minuto." };
    }
    const mapped = messages[error.status];
    if (mapped?.field) {
      return { ok: false, fieldErrors: { [mapped.field]: [mapped.message ?? error.message] } };
    }
    if (mapped) {
      return { ok: false, message: mapped.message ?? error.message };
    }
  }
  console.error(`[${context}]`, error);
  return { ok: false, message: GENERIC_ERROR };
}

const fields = (formData: FormData, ...names: string[]) =>
  Object.fromEntries(names.map((name) => [name, formData.get(name) ?? undefined]));

const optionalText = (value: string | undefined) => (value ? value : undefined);

const idempotencyKeyOf = (formData: FormData) => {
  const key = formData.get("idempotencyKey");
  return typeof key === "string" && key.length > 0 && key.length <= 100 ? key : undefined;
};

/** Status pedido pelo simulador de erros, se for um dos aceitos. */
const simulatedStatusOf = (formData: FormData) => {
  const status = Number(formData.get(SIMULATE_STATUS_FIELD));
  return (SIMULATED_STATUSES as readonly number[]).includes(status) ? status : undefined;
};

export async function depositAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = depositSchema.safeParse(fields(formData, "amount", "description"));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const amount = parseAmount(parsed.data.amount)!;
  try {
    await apiFetch<ITransaction>("/wallet/deposit", {
      method: "POST",
      body: { amount, description: optionalText(parsed.data.description), idempotencyKey: idempotencyKeyOf(formData) },
    });
  } catch (error) {
    return toActionError(
      error,
      {
        400: { field: "amount", message: "Confira o valor informado" },
        409: { message: "Essa operação já foi processada" },
      },
      "depositAction",
    );
  }

  walletChanged();
  return { ok: true, message: `Depósito de ${brl(amount)} realizado` };
}

/**
 * Busca destinatários para o select da transferência (nome ou e-mail).
 * É uma leitura, mas sai do client sob demanda (a cada digitação) e precisa do token, que só existe
 * no servidor — por isso é uma Server Action e não um fetch do browser para a API.
 */
export async function searchRecipientsAction(query: string): Promise<ActionState<IRecipient[]>> {
  const term = typeof query === "string" ? query.trim().slice(0, 100) : "";

  try {
    const recipients = await apiFetch<IRecipient[]>(`/user/search?query=${encodeURIComponent(term)}`);
    return { ok: true, data: recipients };
  } catch (error) {
    return toActionError(error, {}, "searchRecipientsAction");
  }
}

export async function transferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = transferSchema.safeParse(fields(formData, "toEmail", "amount", "description"));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const simulated = simulatedStatusOf(formData);
  if (simulated && !errorSimulatorEnabled()) {
    return { ok: false, message: "Simulador de erros desligado" };
  }

  const amount = parseAmount(parsed.data.amount)!;
  try {
    // Simulador: lança o erro que a API devolveria, sem chamar a API, e segue o caminho de um erro real
    if (simulated) throw new ApiError(simulated, "Erro simulado");

    await apiFetch<ITransaction>("/wallet/transfer", {
      method: "POST",
      body: {
        toEmail: parsed.data.toEmail,
        amount,
        description: optionalText(parsed.data.description),
        idempotencyKey: idempotencyKeyOf(formData),
      },
    });
  } catch (error) {
    return toActionError(
      error,
      {
        400: { field: "toEmail", message: "Não é possível transferir para si mesmo" },
        404: { field: "toEmail", message: "Destinatário não encontrado" },
        409: { message: "Essa operação já foi processada" },
        422: { field: "amount", message: "Saldo insuficiente" },
      },
      "transferAction",
    );
  }

  walletChanged();
  return { ok: true, message: `${brl(amount)} enviados` };
}

/** O id vai ligado com .bind(null, id), não num campo do formulário; a API revalida dono e status. */
export async function reverseAction(transactionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reverseSchema.safeParse(fields(formData, "reason"));
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await apiFetch<ITransaction>(`/wallet/transactions/${encodeURIComponent(transactionId)}/reverse`, {
      method: "POST",
      body: { reason: optionalText(parsed.data.reason) },
    });
  } catch (error) {
    const result = toActionError(
      error,
      {
        400: { message: "Esta operação não pode ser estornada" },
        403: { message: "Só quem fez a operação pode estorná-la" },
        404: { message: "Operação não encontrada" },
        409: { message: "Esta operação já foi estornada" },
      },
      "reverseAction",
    );
    // A lista estava desatualizada (outra aba já estornou, por exemplo): corrige a tela também
    if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
      walletChanged();
    }
    return result;
  }

  walletChanged();
  return { ok: true, message: "Operação estornada" };
}

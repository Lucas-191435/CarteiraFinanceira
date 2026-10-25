import { z } from "zod";
import { brl } from "@/lib/format";
import { amountToCents, decimalToCents, MAX_AMOUNT, parseAmount } from "@/lib/money";

// Validam no client (React Hook Form) e de novo na Server Action. O valor fica como texto no
// formulário ("1.234,56") e só vira número na action, na hora de enviar para a API.

export const amountSchema = z
  .string()
  .trim()
  .min(1, { message: "Informe o valor", abort: true })
  // abort: valor ilegível não segue para as próximas regras (evita duas mensagens no mesmo campo)
  .refine((value) => parseAmount(value) !== null, {
    message: "Valor inválido. Use até 2 casas decimais, ex.: 1.234,56",
    abort: true,
  })
  .refine((value) => (parseAmount(value) ?? 0) > 0, "O valor deve ser maior que zero")
  .refine((value) => (parseAmount(value) ?? 0) <= MAX_AMOUNT, "Valor acima do limite por operação");

const descriptionSchema = z.string().trim().max(140, "Use no máximo 140 caracteres").optional();

export const depositSchema = z.object({
  amount: amountSchema,
  description: descriptionSchema,
});

export const recipientSchema = z.object({
  toEmail: z.email("E-mail inválido"),
});

export const transferSchema = depositSchema.extend(recipientSchema.shape);

/**
 * Versão do formulário de transferir: além das regras acima, bloqueia valor acima do saldo.
 * Compara em centavos inteiros (sem float). A API continua decidindo de verdade (422) —
 * o saldo pode ter mudado desde que a tela foi carregada.
 */
export const transferFormSchema = (balance: string) =>
  transferSchema.superRefine((data, ctx) => {
    const amountCents = amountToCents(data.amount);
    if (amountCents !== null && amountCents > decimalToCents(balance)) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: `Saldo insuficiente. Disponível: ${brl(balance)}`,
      });
    }
  });

export const reverseSchema = z.object({
  reason: z.string().trim().max(140, "Use no máximo 140 caracteres").optional(),
});

export type DepositInput = z.infer<typeof depositSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type ReverseInput = z.infer<typeof reverseSchema>;

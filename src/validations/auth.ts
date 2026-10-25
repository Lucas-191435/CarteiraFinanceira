import { z } from "zod";
import { isCommonPassword, isRepeatedCharacter, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password";

// Os mesmos schemas validam no client (React Hook Form) e de novo na Server Action.

export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  // Sem política de tamanho no login: contas criadas antes da regra de 8 caracteres continuam entrando
  password: z.string().min(1, "Informe a senha"),
});

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`)
  .refine((password) => !isRepeatedCharacter(password), "A senha não pode ser um único caractere repetido")
  .refine((password) => !isCommonPassword(password), "Essa senha é muito comum; escolha outra");

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome").max(100, "Use no máximo 100 caracteres"),
    email: z.email("E-mail inválido"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

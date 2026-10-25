"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Info } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { Field } from "@/components/forms/field";
import { PasswordField } from "@/components/forms/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PublicRoutes } from "@/constants/routes";
import { useServerFieldErrors } from "@/hooks/use-server-field-errors";
import { loginSchema, type LoginInput } from "@/validations/auth";
import { TestUsers } from "./test-users";

type LoginFormProps = {
  /** Pré-preenche o e-mail (vindo do cadastro). */
  email?: string;
  /** Rota para voltar após o login (posta pelo proxy.ts). */
  next?: string;
  /** Aviso acima do formulário (sessão expirada, conta criada). */
  notice?: string;
};

export default function LoginForm({ email = "", next = "", notice }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, undefined);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email, password: "" },
  });
  const { errors } = form.formState;
  useServerFieldErrors(form, state);

  // Valida no client; passou, envia o <form> para a Server Action (que valida de novo)
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const formElement = event.currentTarget;
    form.handleSubmit(() => {
      startTransition(() => formAction(new FormData(formElement)));
    })(event);
  };

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-5">
      {notice && (
        <Alert>
          <Info />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {state?.message && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <input type="hidden" name="next" value={next} />
      <Field id="email" label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
      <PasswordField
        id="password"
        label="Senha"
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register("password")}
      />

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? "Aguarde..." : "Entrar"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link href={PublicRoutes.signup} className="font-medium text-navy hover:underline">
          Criar agora
        </Link>
      </p>

      <TestUsers
        onSelect={(email, password) => {
          form.setValue("email", email, { shouldValidate: true });
          form.setValue("password", password, { shouldValidate: true });
        }}
      />
    </form>
  );
}

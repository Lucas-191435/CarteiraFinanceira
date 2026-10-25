"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { signupAction } from "@/actions/auth";
import { Field } from "@/components/forms/field";
import { PasswordField } from "@/components/forms/password-field";
import { PasswordChecklist } from "@/components/forms/password-checklist";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PublicRoutes } from "@/constants/routes";
import { useServerFieldErrors } from "@/hooks/use-server-field-errors";
import { signupSchema, type SignupInput } from "@/validations/auth";

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, undefined);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });
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
      {state?.message && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Field id="name" label="Nome completo" autoComplete="name" error={errors.name?.message} {...form.register("name")} />
      <Field id="email" label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
      <PasswordField
        id="password"
        label="Senha"
        autoComplete="new-password"
        error={errors.password?.message}
        {...form.register("password")}
      />
      {/* Aparece quando a pessoa começa a digitar */}
      {password && <PasswordChecklist id="password-requirements" password={password} />}
      <PasswordField
        id="confirmPassword"
        label="Confirmar senha"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? "Criando conta..." : "Criar conta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={PublicRoutes.login} className="font-medium text-navy hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./ui";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <div>
        <h1 className="font-display text-3xl text-navy">Entrar</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo de volta.</p>
      </div>
      {/* O fallback é o próprio formulário (vai no HTML estático e funciona sem JS);
          a versão com os parâmetros da URL chega logo depois, por streaming */}
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginFormWithParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);

  const notice = get("expirada")
    ? "Sua sessão expirou. Entre novamente."
    : get("criada")
      ? "Conta criada! Entre para continuar."
      : undefined;

  return <LoginForm email={get("email")} next={get("next")} notice={notice} />;
}

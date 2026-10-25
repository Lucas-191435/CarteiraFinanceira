import { Suspense } from "react";
import { PrivateShellFallback } from "@/components/layout/private-shell-fallback";
import { AuthProvider } from "@/context/auth-context";
import { requireUser } from "@/lib/dal";

// Com cacheComponents, ler a sessão no topo do layout é proibido (bloquearia todo o segmento):
// a leitura fica no AuthGate, atrás de Suspense, que só renderiza a área privada com a sessão válida.
// O fallback tem a mesma estrutura da página da rota, para a troca não "quebrar" o layout.
export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PrivateShellFallback />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AuthProvider user={user}>{children}</AuthProvider>;
}

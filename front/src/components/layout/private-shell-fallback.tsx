"use client";

import { usePathname } from "next/navigation";
import { AppHeaderSkeleton } from "@/components/layout/app-header-skeleton";
import { StatementHero } from "@/components/wallet/statement-hero";
import {
  ActionsSkeleton,
  BalanceSkeleton,
  StatementFilterSkeleton,
  StatementSkeleton,
} from "@/components/wallet/skeletons";
import { PrivateRoutes } from "@/constants/routes";

/**
 * Fallback da área privada enquanto a sessão é validada. Escolhe a estrutura pela rota
 * (a casca estática é gerada por rota, então usePathname já sabe qual é) para a página real
 * entrar exatamente no mesmo lugar, em vez de se remontar.
 */
export function PrivateShellFallback() {
  const pathname = usePathname();

  if (pathname.startsWith(PrivateRoutes.statement)) {
    return (
      <div className="min-h-screen">
        <section className="bg-brand pb-24 text-on-brand">
          <AppHeaderSkeleton />
          <StatementHero />
        </section>
        <main className="mx-auto -mt-16 max-w-5xl px-6 pb-16">
          <section className="space-y-6 rounded-2xl bg-card p-6 shadow-card">
            <StatementFilterSkeleton />
            <StatementSkeleton rows={8} />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <section className="bg-brand pb-24 text-on-brand">
        <AppHeaderSkeleton />
        <div className="mx-auto max-w-5xl px-6 pt-6">
          <BalanceSkeleton />
        </div>
      </section>
      <main className="mx-auto -mt-16 max-w-5xl space-y-6 px-6 pb-16">
        <ActionsSkeleton />
        <section className="rounded-2xl bg-card p-6 shadow-card">
          <StatementSkeleton rows={5} />
        </section>
      </main>
    </div>
  );
}

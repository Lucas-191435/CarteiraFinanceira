import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CardBrands } from "@/components/brand/card-brands";
import { AppHeader } from "@/components/layout/app-header";
import { FADE_IN } from "@/components/loading/text-skeleton";
import { DepositDialog } from "@/components/wallet/deposit-dialog";
import { ActionsSkeleton, BalanceSkeleton, StatementSkeleton } from "@/components/wallet/skeletons";
import { StatementList } from "@/components/wallet/statement-list";
import { TransferDialog } from "@/components/wallet/transfer-dialog";
import { PrivateRoutes } from "@/constants/routes";
import { getWallet, requireUser } from "@/lib/dal";
import { errorSimulatorEnabled } from "@/lib/error-simulator";
import { brl, isNegative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minha carteira" };

// Cada bloco que lê dados fica atrás do próprio Suspense e chega por streaming, com um skeleton
// do mesmo tamanho do conteúdo real e entrada em fade. getWallet/requireUser usam cache() do React:
// os blocos compartilham uma chamada à API por requisição.
export default function WalletPage() {
  return (
    <div className="min-h-screen">
      <section className="bg-brand pb-24 text-on-brand">
        <AppHeader />
        <div className="mx-auto max-w-5xl px-6 pt-6">
          <Suspense fallback={<BalanceSkeleton />}>
            <BalanceHero />
          </Suspense>
        </div>
      </section>

      <main className="mx-auto -mt-16 max-w-5xl space-y-6 px-6 pb-16">
        <Suspense fallback={<ActionsSkeleton />}>
          <WalletActions />
        </Suspense>

        <section className="rounded-2xl bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl text-navy">Últimas movimentações</h2>
            <Link
              href={PrivateRoutes.statement}
              className="flex items-center gap-1 text-sm font-medium text-navy hover:underline"
            >
              Ver extrato completo <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <Suspense fallback={<StatementSkeleton rows={5} />}>
            <StatementList pageSize={5} emptyMessage="Nenhuma movimentação ainda. Faça um depósito para começar." />
          </Suspense>
        </section>

        <CardBrands className="justify-center" />
      </main>
    </div>
  );
}

async function BalanceHero() {
  const [user, wallet] = await Promise.all([requireUser(), getWallet()]);

  return (
    <div className={FADE_IN}>
      <p className="opacity-90">Olá, {user.name}</p>
      <p className="mt-1 text-sm opacity-75">Saldo disponível</p>
      <p className="font-display text-5xl">{brl(wallet.balance)}</p>
      {isNegative(wallet.balance) && (
        <p className="mt-2 max-w-md text-sm">Seu saldo está negativo. Um depósito será somado ao valor atual.</p>
      )}
    </div>
  );
}

async function WalletActions() {
  const wallet = await getWallet();

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", FADE_IN)}>
      <DepositDialog balance={wallet.balance} />
      <TransferDialog balance={wallet.balance} errorSimulator={errorSimulatorEnabled()} />
    </div>
  );
}

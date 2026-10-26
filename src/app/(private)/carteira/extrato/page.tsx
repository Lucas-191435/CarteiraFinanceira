import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { FADE_IN } from "@/components/loading/text-skeleton";
import { MonthFilter } from "@/components/wallet/month-filter";
import { StatementFilterSkeleton, StatementSkeleton } from "@/components/wallet/skeletons";
import { StatementHero } from "@/components/wallet/statement-hero";
import { StatementList } from "@/components/wallet/statement-list";
import { PrivateRoutes } from "@/constants/routes";
import { monthLabel, monthRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Extrato" };

const PAGE_SIZE = 20;

export default function StatementPage({ searchParams }: PageProps<"/carteira/extrato">) {
  return (
    <div className="min-h-screen">
      <section className="bg-brand pb-24 text-on-brand">
        <AppHeader />
        <StatementHero />
      </section>

      <main className="mx-auto -mt-16 max-w-5xl px-6 pb-16">
        <section className="rounded-2xl bg-card p-6 shadow-card">
          {/* searchParams é dado da requisição: com Cache Components, só dentro de Suspense */}
          <Suspense fallback={<StatementFallback />}>
            <StatementContent searchParams={searchParams} />
          </Suspense>
        </section>
      </main>
    </div>
  );
}

async function StatementContent({ searchParams }: Pick<PageProps<"/carteira/extrato">, "searchParams">) {
  const params = await searchParams;
  const month = typeof params.mes === "string" ? params.mes : undefined;
  const page = Math.max(1, Number.parseInt(typeof params.pagina === "string" ? params.pagina : "1", 10) || 1);

  const range = month ? monthRange(month) : null;
  const selectedMonth = range ? month : undefined; // mês inválido na URL = todos

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (selectedMonth) query.set("mes", selectedMonth);
    if (target > 1) query.set("pagina", String(target));
    const qs = query.toString();
    return qs ? `${PrivateRoutes.statement}?${qs}` : PrivateRoutes.statement;
  };

  return (
    <div className={cn("space-y-6", FADE_IN)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-xl text-navy first-letter:uppercase">
          {selectedMonth ? monthLabel(selectedMonth) : "Todas as movimentações"}
        </h2>
        <MonthFilter value={selectedMonth} />
      </div>

      {/* key: ao trocar de mês/página, a lista volta para o skeleton em vez de mostrar os dados antigos */}
      <Suspense key={`${selectedMonth ?? "todos"}-${page}`} fallback={<StatementSkeleton rows={8} />}>
        <StatementList
          page={page}
          pageSize={PAGE_SIZE}
          from={range?.from}
          to={range?.to}
          pageHref={pageHref}
          emptyMessage={
            selectedMonth ? `Nenhuma movimentação em ${monthLabel(selectedMonth)}.` : "Nenhuma movimentação ainda."
          }
        />
      </Suspense>
    </div>
  );
}

/** Mesma estrutura do StatementContent (título + filtro, lista). */
function StatementFallback() {
  return (
    <div className="space-y-6">
      <StatementFilterSkeleton />
      <StatementSkeleton rows={8} />
    </div>
  );
}

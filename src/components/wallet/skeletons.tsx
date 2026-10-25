import { TextSkeleton } from "@/components/loading/text-skeleton";

// Cada skeleton repete a estrutura (tags, paddings, tipografia) do componente real,
// para a troca pelo dado não mudar a altura de nada.

/** Espelha o BalanceHero da /carteira. */
export function BalanceSkeleton() {
  return (
    <div aria-hidden>
      <p className="opacity-90">
        <TextSkeleton className="w-40 bg-on-brand/20" />
      </p>
      <p className="mt-1 text-sm opacity-75">
        <TextSkeleton className="w-28 bg-on-brand/20" />
      </p>
      <p className="font-display text-5xl">
        <TextSkeleton className="w-64 bg-on-brand/20" />
      </p>
    </div>
  );
}

/** Espelha os dois ActionCard (p-5 + ícone p-3 + duas linhas de texto). */
export function ActionsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-card">
          <span className="h-11 w-11 animate-pulse rounded-xl bg-accent/60" />
          <span className="flex-1">
            <span className="block font-semibold">
              <TextSkeleton className="w-24" />
            </span>
            <span className="block text-sm">
              <TextSkeleton className="w-44" />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Espelha o StatementList: cabeçalho do dia + linhas com a mesma altura do StatementItem. */
export function StatementSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      <section>
        <h3 className="text-xs">
          <TextSkeleton className="w-16" />
        </h3>
        <ul className="divide-y">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="flex items-center gap-4 py-3">
              <span className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <TextSkeleton className={i % 2 ? "w-44" : "w-56"} />
                </p>
                <p className="text-xs">
                  <TextSkeleton className="w-28" />
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  <TextSkeleton className="w-24" />
                </p>
                <p className="text-xs">
                  <TextSkeleton className="w-20" />
                </p>
              </div>
              <div className="w-9 shrink-0" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Espelha o topo do extrato completo (título do período + filtro de mês). */
export function StatementFilterSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-hidden>
      <h2 className="font-display text-xl">
        <TextSkeleton className="w-56" />
      </h2>
      {/* SelectTrigger: h-9, w-56 no desktop */}
      <span className="h-9 w-full animate-pulse rounded-md bg-accent sm:w-56" />
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FADE_IN } from "@/components/loading/text-skeleton";
import { getStatement, getWallet } from "@/lib/dal";
import { dayKey, dayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IStatementEntry } from "@/types/IWallet";
import { StatementItem } from "./statement-item";

type StatementListProps = {
  page?: number;
  pageSize: number;
  from?: string;
  to?: string;
  /** Texto quando não há lançamentos. */
  emptyMessage: string;
  /** Monta o link de cada página; sem ele, não há paginação (ex.: "últimas movimentações"). */
  pageHref?: (page: number) => string;
};

/** Lista de lançamentos agrupada por dia (Server Component; sem cache, sempre fresca). */
export async function StatementList({ page = 1, pageSize, from, to, emptyMessage, pageHref }: StatementListProps) {
  // O saldo atual vai para o diálogo de estorno, que avisa quando a conta vai ficar negativa
  const [statement, wallet] = await Promise.all([getStatement(page, pageSize, from, to), getWallet()]);

  if (statement.rows.length === 0) {
    return <p className={cn("py-6 text-center text-sm text-muted-foreground", FADE_IN)}>{emptyMessage}</p>;
  }

  const groups = new Map<string, IStatementEntry[]>();
  for (const entry of statement.rows) {
    const key = dayKey(entry.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const totalPages = Math.max(1, Math.ceil(statement.count / pageSize));

  return (
    <div className={cn("space-y-4", FADE_IN)}>
      {[...groups].map(([key, entries]) => (
        <section key={key}>
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{dayLabel(key)}</h3>
          <ul className="divide-y">
            {entries.map((entry) => (
              <StatementItem key={entry.id} entry={entry} balance={wallet.balance} />
            ))}
          </ul>
        </section>
      ))}

      {pageHref && totalPages > 1 && (
        <nav className="flex items-center justify-between border-t pt-4" aria-label="Paginação do extrato">
          <PageLink href={page > 1 ? pageHref(page - 1) : undefined}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </PageLink>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <PageLink href={page < totalPages ? pageHref(page + 1) : undefined}>
            Próxima <ChevronRight className="h-4 w-4" />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      {/* Sem prefetch: cada link pré-carregado custaria uma chamada ao servidor só por aparecer na tela.
          A página só é buscada no clique, e as já vistas saem do Client Cache. */}
      <Link href={href}>
        {children}
      </Link>
    </Button>
  );
}

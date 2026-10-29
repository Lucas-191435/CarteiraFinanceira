import { ArrowDownLeft, ArrowDownToLine, ArrowUpRight, RotateCcw, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { brl, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IStatementEntry } from "@/types/IWallet";
import { ReverseDialog } from "./reverse-dialog";

/** Título e ícone de um lançamento conforme tipo + direção (tabela da etapa 9 do plano). */
function describe(entry: IStatementEntry): { icon: LucideIcon; title: string } {
  const { type, counterpart } = entry.transaction;
  const credit = entry.direction === "CREDIT";

  if (type === "DEPOSIT") return { icon: ArrowDownToLine, title: "Depósito" };
  if (type === "TRANSFER") {
    return credit
      ? { icon: ArrowDownLeft, title: `Recebido de ${counterpart?.name ?? "outro usuário"}` }
      : { icon: ArrowUpRight, title: `Enviado para ${counterpart?.name ?? "outro usuário"}` };
  }
  // REVERSAL
  if (credit) {
    return { icon: RotateCcw, title: counterpart ? `Estorno recebido de ${counterpart.name}` : "Estorno recebido" };
  }
  return { icon: RotateCcw, title: counterpart ? `Estorno para ${counterpart.name}` : "Estorno de depósito" };
}

export function StatementItem({ entry, balance }: { entry: IStatementEntry; balance: string }) {
  const { icon: Icon, title } = describe(entry);
  const credit = entry.direction === "CREDIT";
  const reversed = entry.transaction.status === "REVERSED";
  const details = [formatTime(entry.createdAt), entry.transaction.description].filter(Boolean).join(" · ");

  return (
    <li className="flex items-center gap-4 py-3">
      <span className="rounded-full bg-secondary p-2 text-navy">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{title}</span>
          {reversed && <Badge variant="secondary">Estornado</Badge>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{details}</p>
      </div>

      <div className="text-right">
        <p
          className={cn(
            "font-semibold whitespace-nowrap",
            reversed ? "text-muted-foreground line-through" : credit ? "text-success" : "text-destructive",
          )}
        >
          {credit ? "+" : "−"} {brl(entry.amount)}
        </p>
        <p className="text-xs whitespace-nowrap text-muted-foreground">Saldo: {brl(entry.balanceAfter)}</p>
      </div>

      {/* Regra decidida pela API; o front só obedece */}
      <div className="w-9 shrink-0">{entry.transaction.canReverse && <ReverseDialog entry={entry} title={title} balance={balance} />}</div>
    </li>
  );
}

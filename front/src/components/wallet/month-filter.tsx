"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrivateRoutes } from "@/constants/routes";
import { lastMonths, monthLabel } from "@/lib/format";

const ALL = "todos";
const MONTHS = 12;

/**
 * Filtro do extrato por mês; o estado fica na URL (?mes=2026-09). Mudar o mês volta para a página 1.
 *
 * Os últimos 12 meses são calculados aqui, com o relógio do navegador: se fosse no servidor, o
 * new Date() seria uma leitura dinâmica fora de cache e impediria o Client Cache de reaproveitar a
 * tela. Não há divergência servidor × navegador: as opções só são desenhadas quando o select abre, e
 * o mês selecionado vem da URL.
 */
export function MonthFilter({ value }: { value?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const options = useMemo(() => lastMonths(new Date(), MONTHS), []);

  const onValueChange = (next: string) => {
    const href = next === ALL ? PrivateRoutes.statement : `${PrivateRoutes.statement}?mes=${next}`;
    startTransition(() => router.push(href));
  };

  return (
    <Select value={value ?? ALL} onValueChange={onValueChange} disabled={isPending}>
      <SelectTrigger className="w-full capitalize sm:w-56" aria-label="Filtrar por mês">
        {/* Rótulo vindo da URL, não do relógio: o mesmo no servidor e no navegador */}
        <SelectValue>{value ? monthLabel(value) : "Todos os meses"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos os meses</SelectItem>
        {/* Mês vindo de um link antigo, fora dos últimos 12: continua selecionável */}
        {value && !options.includes(value) && (
          <SelectItem value={value} className="capitalize">
            {monthLabel(value)}
          </SelectItem>
        )}
        {options.map((month) => (
          <SelectItem key={month} value={month} className="capitalize">
            {monthLabel(month)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

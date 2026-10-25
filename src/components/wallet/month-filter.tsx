"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrivateRoutes } from "@/constants/routes";

const ALL = "todos";

/** Filtro do extrato por mês; o estado fica na URL (?mes=2026-09). Mudar o mês volta para a página 1. */
export function MonthFilter({ value, options }: { value?: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onValueChange = (next: string) => {
    const href = next === ALL ? PrivateRoutes.statement : `${PrivateRoutes.statement}?mes=${next}`;
    startTransition(() => router.push(href));
  };

  return (
    <Select value={value ?? ALL} onValueChange={onValueChange} disabled={isPending}>
      <SelectTrigger className="w-full capitalize sm:w-56" aria-label="Filtrar por mês">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos os meses</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="capitalize">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

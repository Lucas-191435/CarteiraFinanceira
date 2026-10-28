"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SimulatedStatus } from "@/constants/error-simulator";
import { useAuth } from "@/context/auth-context";
import { decimalToCents, MAX_AMOUNT, maskCurrency } from "@/lib/money";
import type { IRecipient } from "@/types/IUser";

/**
 * Um erro para provocar na transferência. Sem `recipient`, usa um destinatário real (a API precisa
 * achá-lo antes de checar o saldo). Com `simulateStatus`, a action lança o erro sem chamar a API.
 */
export type ErrorScenario = {
  label: string;
  hint: string;
  recipient?: IRecipient;
  amount: string;
  simulateStatus?: SimulatedStatus;
};

// Só precisa passar no Zod da action: nos simulados a API não é chamada
const PLACEHOLDER: IRecipient = { name: "Simulação", email: "simulacao@carteira.com" };

// O teto por operação, e não "saldo + R$ 1": se o saldo subir entre a tela e o clique, um valor
// apertado viraria uma transferência de verdade
const ABOVE_BALANCE = maskCurrency(String(MAX_AMOUNT * 100));

function scenarioGroups(self: IRecipient, balance: string): { title: string; scenarios: ErrorScenario[] }[] {
  // Saldo no teto: o 422 não é garantido, então o cenário sai da lista
  const canExceedBalance = decimalToCents(balance) < MAX_AMOUNT * 100;

  return [
    {
      title: "Pela API",
      scenarios: [
        { label: "Transferir para si mesmo", hint: "400", recipient: self, amount: "1,00" },
        {
          label: "Destinatário inexistente",
          hint: "404",
          recipient: { name: "E-mail não cadastrado", email: "nao-existe@carteira.com" },
          amount: "1,00",
        },
        ...(canExceedBalance ? [{ label: "Saldo insuficiente", hint: "422", amount: ABOVE_BALANCE }] : []),
      ],
    },
    {
      title: "Validação da action",
      scenarios: [{ label: "Valor inválido", hint: "Zod", recipient: PLACEHOLDER, amount: "abc" }],
    },
    {
      title: "Simulados na action",
      scenarios: [
        { label: "Operação já processada", hint: "409", recipient: PLACEHOLDER, amount: "1,00", simulateStatus: 409 },
        { label: "Muitas tentativas", hint: "429", recipient: PLACEHOLDER, amount: "1,00", simulateStatus: 429 },
        { label: "Erro inesperado", hint: "500", recipient: PLACEHOLDER, amount: "1,00", simulateStatus: 500 },
        {
          label: "Sessão expirada (desloga)",
          hint: "401",
          recipient: PLACEHOLDER,
          amount: "1,00",
          simulateStatus: 401,
        },
      ],
    },
  ];
}

/** Lista de erros para forçar na modal de transferência (ligada por ENABLE_ERROR_SIMULATOR). */
export function ErrorSimulator({
  balance,
  disabled,
  onRun,
}: {
  balance: string;
  disabled?: boolean;
  onRun: (scenario: ErrorScenario) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const groups = scenarioGroups({ name: user.name, email: user.email }, balance);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} className="mr-auto">
          <FlaskConical /> Simular erro
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {groups.map((group) => (
          <div key={group.title} className="py-1">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{group.title}</p>
            {group.scenarios.map((scenario) => (
              <button
                key={scenario.label}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  setOpen(false);
                  onRun(scenario);
                }}
              >
                {scenario.label}
                <span className="text-xs text-muted-foreground">{scenario.hint}</span>
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

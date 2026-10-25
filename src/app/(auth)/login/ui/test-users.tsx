"use client";

import { Badge } from "@/components/ui/badge";

// Usuários criados pelo seed da API (api/prisma/seeds). A API não expõe uma lista deles,
// então ficam fixos aqui e só aparecem com NEXT_PUBLIC_SHOW_TEST_USERS=true.
const TEST_PASSWORD = "Teste123@";
const TEST_USERS = [
  { email: "ana@carteira.com", name: "Ana", hint: "Salário e empréstimo" },
  { email: "bruno@carteira.com", name: "Bruno", hint: "Recebe aluguéis" },
  { email: "carla@carteira.com", name: "Carla", hint: "Ficou negativa" },
  { email: "diego@carteira.com", name: "Diego", hint: "Estornou envio errado" },
  { email: "elisa@carteira.com", name: "Elisa", hint: "Estornou depósito" },
  { email: "fabio@carteira.com", name: "Fábio", hint: "Saldo negativo" },
];

export function TestUsers({ onSelect }: { onSelect: (email: string, password: string) => void }) {
  if (process.env.NEXT_PUBLIC_SHOW_TEST_USERS !== "true") return null;

  return (
    <div className="space-y-2 rounded-xl border border-dashed p-4">
      <p className="text-xs font-medium text-muted-foreground">
        Usuários de teste <Badge variant="secondary">senha {TEST_PASSWORD}</Badge>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {TEST_USERS.map((user) => (
          <button
            key={user.email}
            type="button"
            onClick={() => onSelect(user.email, TEST_PASSWORD)}
            className="rounded-lg bg-secondary px-3 py-2 text-left text-sm transition hover:bg-secondary/70"
          >
            <span className="block font-semibold text-navy">{user.name}</span>
            <span className="block text-xs text-muted-foreground">{user.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PrivateRoutes } from "@/constants/routes";

/** Topo do extrato completo. Estático: usado na página e no skeleton da área privada. */
export function StatementHero() {
  return (
    <div className="mx-auto max-w-5xl px-6 pt-6">
      <Link href={PrivateRoutes.wallet} className="inline-flex items-center gap-1 text-sm opacity-90 hover:underline">
        <ChevronLeft className="h-4 w-4" /> Minha carteira
      </Link>
      <h1 className="mt-2 font-display text-4xl">Extrato</h1>
      <p className="text-sm opacity-75">Entradas, saídas e estornos da sua carteira.</p>
    </div>
  );
}

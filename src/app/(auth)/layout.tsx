import { BoltLogo } from "@/components/brand/bolt-logo";
import { CardBrands } from "@/components/brand/card-brands";

// Estático: não lê a sessão. Quem tira o usuário logado daqui é o proxy.ts.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-brand p-10 px-20 text-on-brand md:flex">
        <BoltLogo light />
        <h2 className="font-display text-4xl leading-tight">
          Pagamentos rápidos,
          <br />
          carteira simples.
        </h2>
        <CardBrands />
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          <BoltLogo className="md:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}

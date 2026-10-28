import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicRoutes } from "@/constants/routes";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Button asChild className="mt-6">
          <Link href={PublicRoutes.home}>Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}

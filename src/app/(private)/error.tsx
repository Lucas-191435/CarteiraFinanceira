"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Falhas da API que não são de sessão (401 vira redirect no requireUser)
export default function PrivateError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">Não conseguimos falar com o servidor agora.</p>
        <Button className="mt-6" onClick={() => retry()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

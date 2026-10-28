"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { BoltLogo } from "@/components/brand/bolt-logo";
import { Button } from "@/components/ui/button";
import { PrivateRoutes } from "@/constants/routes";
import { useAuth } from "@/context/auth-context";

/** Header da área logada; fica dentro da faixa bg-brand de cada página. */
export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
      <Link href={PrivateRoutes.wallet} aria-label="Minha carteira">
        <BoltLogo light />
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm opacity-90 sm:inline">{user.email}</span>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-on-brand hover:bg-on-brand/10 hover:text-on-brand"
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </form>
      </div>
    </header>
  );
}

import { BoltLogo } from "@/components/brand/bolt-logo";
import { TextSkeleton } from "@/components/loading/text-skeleton";

/** Mesmas classes e alturas do AppHeader; o logo é o real (não depende de dados). */
export function AppHeaderSkeleton() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
      <BoltLogo light />
      <div className="flex items-center gap-3">
        <span className="hidden text-sm sm:inline">
          <TextSkeleton className="w-36 bg-on-brand/20" />
        </span>
        {/* Botão "Sair" size="sm" = h-8 */}
        <span aria-hidden className="h-8 w-[70px] animate-pulse rounded-md bg-on-brand/20" />
      </div>
    </header>
  );
}

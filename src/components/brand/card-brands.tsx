import { cn } from "@/lib/utils";

const chip = "flex h-10 w-16 items-center justify-center rounded-md bg-card shadow-sm";

/** Bandeiras de cartão desenhadas em CSS (elemento decorativo da marca). */
export function CardBrands({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)} aria-hidden>
      <div className={chip} title="Visa">
        <span className="font-display text-lg italic text-visa">VISA</span>
      </div>
      <div className={chip} title="Mastercard">
        <span className="relative flex">
          <span className="h-6 w-6 rounded-full bg-mc-red" />
          <span className="-ml-2.5 h-6 w-6 rounded-full bg-mc-yellow opacity-90" />
        </span>
      </div>
      <div className={chip} title="Elo">
        <span className="flex items-center gap-0.5 font-display text-base text-foreground">
          <span className="flex flex-col gap-px">
            <span className="h-1 w-1 rounded-full bg-elo-yellow" />
            <span className="h-1 w-1 rounded-full bg-elo-blue" />
            <span className="h-1 w-1 rounded-full bg-elo-red" />
          </span>
          elo
        </span>
      </div>
      <div className={chip} title="BrasilCard">
        <span className="rounded bg-navy px-1.5 py-0.5 text-[9px] font-bold text-elo-yellow">BrasilCard</span>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * Skeleton em linha para usar DENTRO do mesmo elemento de texto do conteúdo real
 * (ex.: <p className="text-5xl"><TextSkeleton /></p>). Assim a altura da linha é a mesma
 * e nada "pula" quando o dado chega. É <span> porque <div> dentro de <p> é HTML inválido.
 */
export function TextSkeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-[0.75em] animate-pulse rounded-md bg-accent align-middle", className)}
    />
  );
}

/** Entrada suave do conteúdo que chega por streaming (respeita "reduzir movimento"). */
export const FADE_IN = "animate-in fade-in duration-300 motion-reduce:animate-none";

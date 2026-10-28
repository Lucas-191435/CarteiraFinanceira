import { forwardRef, type ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionCardProps = ComponentProps<"button"> & {
  icon: LucideIcon;
  title: string;
  description: string;
};

/** Card clicável que abre o dialog de uma operação (usado como DialogTrigger asChild). */
export const ActionCard = forwardRef<HTMLButtonElement, ActionCardProps>(function ActionCard(
  { icon: Icon, title, description, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl bg-card p-5 text-left shadow-card transition hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    >
      <span className="rounded-xl bg-accent p-3 text-accent-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
});

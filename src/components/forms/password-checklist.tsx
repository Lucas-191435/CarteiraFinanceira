import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_REQUIREMENTS } from "@/validations/password";

/** Requisitos da senha marcados conforme a pessoa digita. */
export function PasswordChecklist({ id, password }: { id: string; password: string }) {
  return (
    <ul id={id} className="space-y-1.5 rounded-lg bg-muted px-3 py-2.5" aria-label="Requisitos da senha">
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.isMet(password);
        return (
          <li
            key={requirement.id}
            className={cn("flex items-center gap-2 text-xs transition-colors", met ? "text-success" : "text-muted-foreground")}
          >
            {met ? <Check className="size-3.5 shrink-0" strokeWidth={3} /> : <Circle className="size-3.5 shrink-0" />}
            <span>{requirement.label}</span>
            <span className="sr-only">{met ? "(atendido)" : "(pendente)"}</span>
          </li>
        );
      })}
    </ul>
  );
}

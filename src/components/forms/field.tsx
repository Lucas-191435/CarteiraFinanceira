import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  /** Orientação exibida abaixo do campo; dá lugar ao erro quando houver um. */
  hint?: string;
};

/** Label + Input + dica/erro, com os atributos de acessibilidade ligados. */
export function Field({ id, label, error, hint, ...inputProps }: FieldProps) {
  const messageId = error || hint ? `${id}-message` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={Boolean(error)} aria-describedby={messageId} {...inputProps} />
      {error ? (
        <p id={messageId} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionState } from "@/types/action";

/** Copia os erros por campo de uma Server Action (ex.: e-mail já cadastrado) para o React Hook Form. */
export function applyServerFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, state: ActionState<unknown>) {
  if (!state || state.ok || !state.fieldErrors) return;
  for (const [field, messages] of Object.entries(state.fieldErrors)) {
    if (messages?.[0]) {
      form.setError(field as Path<T>, { message: messages[0] });
    }
  }
}

/** Versão para formulários com useActionState: reaplica sempre que o estado muda. */
export function useServerFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, state: ActionState<unknown>) {
  useEffect(() => {
    applyServerFieldErrors(form, state);
  }, [form, state]);
}

/** Resultado de uma Server Action. Sucesso com redirect não retorna nada. */
export type ActionState<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

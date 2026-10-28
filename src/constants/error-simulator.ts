// Simulador de erros da transferência: força na action os status que não dá para provocar pela API
// com facilidade. Fora de lib/error-simulator.ts porque o client também usa a lista (sem server-only).

export const SIMULATED_STATUSES = [401, 409, 429, 500] as const;

export type SimulatedStatus = (typeof SIMULATED_STATUSES)[number];

/** Campo do FormData com o status a simular. */
export const SIMULATE_STATUS_FIELD = "simulateStatus";

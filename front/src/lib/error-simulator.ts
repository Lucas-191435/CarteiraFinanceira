import "server-only";

/**
 * Liga o simulador de erros da transferência (ENABLE_ERROR_SIMULATOR=true). Lido no servidor em
 * tempo de execução: a página decide se mostra o botão e a action recusa a simulação sem a variável.
 */
export const errorSimulatorEnabled = () => process.env.ENABLE_ERROR_SIMULATOR === "true";

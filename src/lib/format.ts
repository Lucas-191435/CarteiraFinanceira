// Datas sempre no horário de Brasília: o servidor Next roda em UTC, e sem fuso explícito
// uma operação às 22h apareceria como do dia seguinte.
export const TIME_ZONE = "America/Sao_Paulo";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Formata um valor da API em reais. Aceita a string decimal da API sem passar por float
 * (Intl formata strings numéricas com precisão exata). Só para exibição: contas ficam na API.
 */
export const brl = (value: string | number) => BRL.format(value as Intl.StringNumericLiteral);

/** Saldo negativo sem converter para número. */
export const isNegative = (value: string) => value.trim().startsWith("-");

const TIME = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_LABEL = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "numeric", month: "long" });
const DAY_LABEL_YEAR = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });

export const formatTime = (iso: string) => TIME.format(new Date(iso));

/** "2026-10-24" no fuso de Brasília. */
export const dayKey = (date: Date | string) => DAY_KEY.format(new Date(date));

/** "Hoje", "Ontem", "23 de outubro" ou "23 de outubro de 2025". */
export function dayLabel(key: string, now: Date) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";

  const date = new Date(`${key}T12:00:00-03:00`);
  return key.slice(0, 4) === today.slice(0, 4) ? DAY_LABEL.format(date) : DAY_LABEL_YEAR.format(date);
}

// ---- Meses (filtro do extrato) ----
// Brasília não tem horário de verão desde 2019: o offset é fixo em -03:00.

/** Mês corrente em Brasília, "2026-10". */
export const currentMonth = (now: Date) => dayKey(now).slice(0, 7);

const isMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Intervalo [from, to) do mês em Brasília, em ISO UTC para a API. */
export function monthRange(month: string): { from: string; to: string } | null {
  if (!isMonth(month)) return null;
  return {
    from: new Date(`${month}-01T00:00:00-03:00`).toISOString(),
    to: new Date(`${shiftMonth(month, 1)}-01T00:00:00-03:00`).toISOString(),
  };
}

/** "setembro de 2026". */
export const monthLabel = (month: string) => MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));

/** Os últimos `count` meses, do mais recente para o mais antigo. */
export const lastMonths = (now: Date, count: number) =>
  Array.from({ length: count }, (_, i) => shiftMonth(currentMonth(now), -i));

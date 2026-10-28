// Único ponto em que o front converte valor para número: para ENVIAR à API (o DTO exige number).
// Exibição continua com brl() sobre a string que a API devolve.

/** Mesmo teto por operação da API. */
export const MAX_AMOUNT = 1_000_000_000;

// Máscara "centavos" (como em app de banco): os dígitos digitados entram pela direita.
// 1 → "0,01", 12 → "0,12", 1234 → "12,34", 123456 → "1.234,56".
const MASK = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MAX_MASK_DIGITS = 12; // até 9.999.999.999,99; o teto real é validado no schema

export function maskCurrency(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_MASK_DIGITS);
  if (!digits) return "";
  return MASK.format(Number(digits) / 100);
}

/**
 * Valor decimal da API ("16450", "-200.5") em centavos inteiros, sem passar por float.
 * Usado só para comparar com o valor digitado (bloquear transferência acima do saldo).
 */
export function decimalToCents(value: string): number {
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?/);
  if (!match) return 0;
  const [, sign, integer, fraction = ""] = match;
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
  return sign ? -cents : cents;
}

/** Valor digitado ("1.234,56") em centavos inteiros, ou null se inválido. */
export function amountToCents(input: string): number | null {
  const amount = parseAmount(input);
  return amount === null ? null : Math.round(amount * 100);
}

/**
 * Lê um valor digitado em reais. Aceita "1234,56", "1.234,56", "1234.56" e "R$ 10".
 * Com vírgula, pontos são milhar. Sem vírgula, "1.234" é milhar e "10.5" é decimal.
 * Mais de 2 casas decimais é inválido (não arredonda). Retorna null se não entender.
 */
export function parseAmount(input: string): number | null {
  const value = input.replace(/R\$|\s/g, "");
  if (!value) return null;

  let normalized: string;
  if (value.includes(",")) {
    // "1.234,56" ou "1234,56": milhar opcional com ponto, até 2 casas depois da vírgula
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(value)) return null;
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    normalized = value.replace(/\./g, "");
  } else if (/^\d+(\.\d{1,2})?$/.test(value)) {
    normalized = value;
  } else {
    return null;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

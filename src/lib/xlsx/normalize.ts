import Decimal from "decimal.js";

/** Fração (0.268) → pontos percentuais "26.800" (NUMERIC(6,3)). */
export function fractionToPercentPoints(fraction: number): string {
  return new Decimal(fraction).times(100).toFixed(3);
}

/** Número da planilha → string monetária "1234.56" (NUMERIC(14,2), half-up). */
export function toMoneyString(value: number): string {
  return new Decimal(value).toFixed(2, Decimal.ROUND_HALF_UP);
}

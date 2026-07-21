import Decimal from "decimal.js";

/**
 * Acumula uma série de variações mensais (em pontos percentuais, ex.: "0.62" = 0,62%)
 * em uma taxa anual equivalente (pontos percentuais, 4 casas). Usado para IPCA, IGP-M e
 * poupança, cujas séries do SGS vêm mês a mês.
 *
 * anual = (∏ (1 + mês_i/100) − 1) × 100
 */
export function accumulateMonthlyToAnnual(monthlyPercents: string[]): string {
  const factor = monthlyPercents.reduce(
    (acc, m) => acc.times(new Decimal(1).plus(new Decimal(m).div(100))),
    new Decimal(1),
  );
  return factor.minus(1).times(100).toFixed(4);
}

/**
 * Anualiza uma taxa diária (em pontos percentuais, ex.: "0.041" = 0,041% ao dia) pela
 * convenção de 252 dias úteis — padrão para o CDI.
 *
 * anual = ((1 + dia/100)^252 − 1) × 100
 */
export function annualizeDailyRate(dailyPercent: string, businessDays = 252): string {
  return new Decimal(1)
    .plus(new Decimal(dailyPercent).div(100))
    .pow(businessDays)
    .minus(1)
    .times(100)
    .toFixed(4);
}

import Decimal from "decimal.js";

function rateFraction(annualRatePercent: string): Decimal {
  return new Decimal(annualRatePercent).div(100);
}

/** Taxa mensal equivalente a partir da anual: (1 + taxaAnual)^(1/12) − 1. Retorna fração string 8 casas. */
export function monthlyEquivalentRate(annualRatePercent: string): string {
  const annual = new Decimal(1).plus(rateFraction(annualRatePercent));
  return annual.pow(new Decimal(1).div(12)).minus(1).toFixed(8);
}

/** FV de aporte mensal no fim de cada mês (prompt §16 Modo A). Taxa zero → aporte × n. */
export function calculateMonthlyContributionFutureValue(monthlyContribution: string, annualRatePercent: string, months: number): string {
  const contribution = new Decimal(monthlyContribution);
  const i = new Decimal(monthlyEquivalentRate(annualRatePercent));
  if (i.isZero()) return contribution.times(months).toFixed(2, Decimal.ROUND_HALF_UP);
  const factor = i.plus(1).pow(months).minus(1).div(i);
  return contribution.times(factor).toFixed(2, Decimal.ROUND_HALF_UP);
}

/** FV de capital inicial (prompt §16 Modo B): inicial × (1 + taxaAnual)^anos. anos pode ser fracionário (meses/12). */
export function calculateCompoundFutureValue(initialAmount: string, annualRatePercent: string, years: string): string {
  const factor = new Decimal(1).plus(rateFraction(annualRatePercent)).pow(new Decimal(years));
  return new Decimal(initialAmount).times(factor).toFixed(2, Decimal.ROUND_HALF_UP);
}

/** Taxa anual efetiva do CDI: taxaCdiAnual × percentualCdi/100 (prompt §17). */
export function cdiEffectiveAnnualRate(cdiAnnualRatePercent: string, cdiPercentage: string): string {
  return new Decimal(cdiAnnualRatePercent).times(new Decimal(cdiPercentage).div(100)).toFixed(4);
}

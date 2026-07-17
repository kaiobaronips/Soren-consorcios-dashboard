import Decimal from "decimal.js";

/** Fração decimal da taxa anual: "6.5" (pontos percentuais) → 0.065. */
function rateFraction(annualRatePercent: string): Decimal {
  return new Decimal(annualRatePercent).div(100);
}

/** Índice do ano de contrato de um mês (0-based): floor((mes-1)/12). */
export function contractYearOfMonth(month: number): number {
  return Math.floor((month - 1) / 12);
}

/** Fator de correção anual: (1 + taxaAnual)^ano. rate em pontos percentuais ("6.5"). */
export function annualCorrectionFactor(annualRatePercent: string, year: number): string {
  return new Decimal(1).plus(rateFraction(annualRatePercent)).pow(year).toFixed(6);
}

/** Carta corrigida no ano: base × (1 + taxa)^ano. */
export function calculateCorrectedCredit(baseCredit: string, annualRatePercent: string, year: number): string {
  const factor = new Decimal(1).plus(rateFraction(annualRatePercent)).pow(year);
  return new Decimal(baseCredit).times(factor).toFixed(2, Decimal.ROUND_HALF_UP);
}

/** Parcela corrigida no ANO informado: base × (1 + taxa)^ano. */
export function calculateCorrectedInstallment(baseInstallment: string, annualRatePercent: string, year: number): string {
  const factor = new Decimal(1).plus(rateFraction(annualRatePercent)).pow(year);
  return new Decimal(baseInstallment).times(factor).toFixed(2, Decimal.ROUND_HALF_UP);
}

/** Parcela do MÊS: base × (1 + taxa)^floor((mes-1)/12). */
export function correctedInstallmentForMonth(baseInstallment: string, annualRatePercent: string, month: number): string {
  return calculateCorrectedInstallment(baseInstallment, annualRatePercent, contractYearOfMonth(month));
}

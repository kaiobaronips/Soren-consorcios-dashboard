import Decimal from "decimal.js";
import { calculateCorrectedCredit } from "./correction";
import {
  applySimpleNetDiscount,
  calculateCompoundFutureValue,
  calculateMonthlyContributionFutureValue,
  cdiEffectiveAnnualRate,
} from "./investment";

export type CdiProjectionInput = {
  cdiAnnualRatePercent: string;
  cdiPercentage: string;
  monthlyContribution: string;
  initialAmount: string;
  years: number;
  creditAmount: string;
  consortiumAnnualRatePercent: string;
  /** Quando presente, aplica desconto simples de IR/taxa sobre o rendimento. */
  discount?: { irRatePercent: string; adminFeeRatePercent: string };
};

export type CdiProjectionYearPoint = {
  year: number;
  contributed: string;
  balance: string;         // montante exibido (líquido se houver desconto, senão bruto)
  correctedCredit: string;
};

export type CdiProjection = {
  effectiveAnnualRatePercent: string;
  totalContributed: string;
  grossAmount: string;
  earnings: string;
  netAmount: string;        // = grossAmount quando não há desconto
  displayAmount: string;    // netAmount se discount, senão grossAmount
  correctedCredit: string;
  differenceVsCredit: string; // displayAmount − correctedCredit
  yearly: CdiProjectionYearPoint[];
};

function combinedGrossAndContributed(
  monthlyContribution: string,
  initialAmount: string,
  effectiveAnnualRatePercent: string,
  months: number,
): { gross: string; contributed: string; earnings: string } {
  const fvContribution = calculateMonthlyContributionFutureValue(monthlyContribution, effectiveAnnualRatePercent, months);
  const fvInitial = calculateCompoundFutureValue(initialAmount, effectiveAnnualRatePercent, String(months / 12));
  const gross = new Decimal(fvContribution).plus(fvInitial).toFixed(2, Decimal.ROUND_HALF_UP);
  const contributed = new Decimal(monthlyContribution).times(months).plus(initialAmount).toFixed(2, Decimal.ROUND_HALF_UP);
  const earnings = new Decimal(gross).minus(contributed).toFixed(2, Decimal.ROUND_HALF_UP);
  return { gross, contributed, earnings };
}

/**
 * Projeção completa do CdiCompoundSlider (prompt §17): combina aporte mensal + capital
 * inicial rendendo a um percentual do CDI, com série anual e comparação à carta corrigida
 * do consórcio (que corrige por ANO INTEIRO). Função pura — toda a matemática vive aqui,
 * o componente apenas renderiza o resultado.
 */
export function cdiCompoundProjection(input: CdiProjectionInput): CdiProjection {
  const effectiveAnnualRatePercent = cdiEffectiveAnnualRate(input.cdiAnnualRatePercent, input.cdiPercentage);
  const months = input.years * 12;

  const { gross, contributed, earnings } = combinedGrossAndContributed(
    input.monthlyContribution, input.initialAmount, effectiveAnnualRatePercent, months,
  );
  const netAmount = input.discount
    ? applySimpleNetDiscount(gross, earnings, input.discount.irRatePercent, input.discount.adminFeeRatePercent)
    : gross;
  const displayAmount = input.discount ? netAmount : gross;

  const correctedCredit = calculateCorrectedCredit(input.creditAmount, input.consortiumAnnualRatePercent, input.years);
  const differenceVsCredit = new Decimal(displayAmount).minus(correctedCredit).toFixed(2, Decimal.ROUND_HALF_UP);

  const yearly: CdiProjectionYearPoint[] = [];
  for (let y = 1; y <= input.years; y++) {
    const point = combinedGrossAndContributed(input.monthlyContribution, input.initialAmount, effectiveAnnualRatePercent, y * 12);
    const balance = input.discount
      ? applySimpleNetDiscount(point.gross, point.earnings, input.discount.irRatePercent, input.discount.adminFeeRatePercent)
      : point.gross;
    yearly.push({
      year: y,
      contributed: point.contributed,
      balance,
      correctedCredit: calculateCorrectedCredit(input.creditAmount, input.consortiumAnnualRatePercent, y),
    });
  }

  return {
    effectiveAnnualRatePercent,
    totalContributed: contributed,
    grossAmount: gross,
    earnings,
    netAmount,
    displayAmount,
    correctedCredit,
    differenceVsCredit,
    yearly,
  };
}

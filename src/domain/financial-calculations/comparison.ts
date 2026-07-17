import Decimal from "decimal.js";
import { calculateCorrectedCredit } from "./correction";
import { calculateCompoundFutureValue, calculateMonthlyContributionFutureValue } from "./investment";

export type ComparisonMode = "monthly_contribution" | "initial_capital";

export type ComparisonInput = {
  mode: ComparisonMode;
  monthlyInstallment: string; // parcela base (aporte no Modo A)
  creditAmount: string; // carta (capital no Modo B)
  months: number;
  investmentAnnualRatePercent: string; // taxa do investimento comparado (CDI/IPCA/poupança/custom)
  consortiumAnnualRatePercent: string; // índice contratual do consórcio (IGP-M/IPCA)
};

export type YearlyComparisonPoint = {
  year: number;
  invested: string;
  investmentBalance: string;
  correctedCredit: string;
};

export type ComparisonResult = {
  mode: ComparisonMode;
  totalContributed: string; // Modo A: aporte×meses; Modo B: capital inicial
  investmentGross: string; // saldo bruto do investimento
  investmentEarnings: string; // rendimento = bruto − aportado
  correctedCredit: string; // carta corrigida pelo índice contratual no período
  differenceVsCredit: string; // investmentGross − correctedCredit
  yearly: YearlyComparisonPoint[];
};

function investmentGrossAt(input: ComparisonInput, monthsElapsed: number): string {
  return input.mode === "monthly_contribution"
    ? calculateMonthlyContributionFutureValue(input.monthlyInstallment, input.investmentAnnualRatePercent, monthsElapsed)
    : calculateCompoundFutureValue(input.creditAmount, input.investmentAnnualRatePercent, new Decimal(monthsElapsed).div(12).toString());
}

function investedAt(input: ComparisonInput, monthsElapsed: number): string {
  return input.mode === "monthly_contribution"
    ? new Decimal(input.monthlyInstallment).times(monthsElapsed).toFixed(2, Decimal.ROUND_HALF_UP)
    : new Decimal(input.creditAmount).toFixed(2, Decimal.ROUND_HALF_UP);
}

/** Série anual: um ponto por ano contratual completo, mais um ponto final parcial se meses não for múltiplo de 12. */
function buildYearlyComparisonSeries(input: ComparisonInput): YearlyComparisonPoint[] {
  const { creditAmount, consortiumAnnualRatePercent, months } = input;
  const fullYears = Math.floor(months / 12);
  const points: YearlyComparisonPoint[] = [];

  const pushPoint = (monthsElapsed: number, year: number) => {
    points.push({
      year,
      invested: investedAt(input, monthsElapsed),
      investmentBalance: investmentGrossAt(input, monthsElapsed),
      correctedCredit: calculateCorrectedCredit(creditAmount, consortiumAnnualRatePercent, year),
    });
  };

  for (let i = 1; i <= fullYears; i++) {
    pushPoint(i * 12, i);
  }
  if (months % 12 !== 0) {
    pushPoint(months, months / 12);
  }

  return points;
}

export function compareConsortiumAndInvestments(input: ComparisonInput): ComparisonResult {
  const { mode, creditAmount, months, consortiumAnnualRatePercent } = input;

  const totalContributed = investedAt(input, months);
  const investmentGross = investmentGrossAt(input, months);
  const investmentEarnings = new Decimal(investmentGross).minus(totalContributed).toFixed(2, Decimal.ROUND_HALF_UP);

  const correctedCredit = calculateCorrectedCredit(creditAmount, consortiumAnnualRatePercent, Math.floor(months / 12));
  const differenceVsCredit = new Decimal(investmentGross).minus(correctedCredit).toFixed(2, Decimal.ROUND_HALF_UP);

  return {
    mode,
    totalContributed,
    investmentGross,
    investmentEarnings,
    correctedCredit,
    differenceVsCredit,
    yearly: buildYearlyComparisonSeries(input),
  };
}

import Decimal from "decimal.js";
import { calculateCorrectedInstallment, contractYearOfMonth, correctedInstallmentForMonth } from "./correction";

export type ScheduleEntry = { month: number; year: number; installment: string };
export type YearlyPoint = { year: number; correctedInstallment: string; correctedCredit: string; cumulativePaid: string };

/** Parcela mês a mês do 1 até termMonths (ou até untilMonth, se informado ≤ term). */
export function calculateCorrectedPaymentSchedule(
  baseInstallment: string, annualRatePercent: string, termMonths: number, untilMonth?: number,
): ScheduleEntry[] {
  const last = Math.min(untilMonth ?? termMonths, termMonths);
  const entries: ScheduleEntry[] = [];
  for (let m = 1; m <= last; m++) {
    entries.push({
      month: m,
      year: contractYearOfMonth(m),
      installment: correctedInstallmentForMonth(baseInstallment, annualRatePercent, m),
    });
  }
  return entries;
}

/** Total pago = soma das parcelas corrigidas do mês 1 até untilMonth (NUNCA última parcela × prazo). */
export function calculateTotalProjectedPayments(baseInstallment: string, annualRatePercent: string, untilMonth: number): string {
  const schedule = calculateCorrectedPaymentSchedule(baseInstallment, annualRatePercent, untilMonth, untilMonth);
  const total = schedule.reduce((acc, e) => acc.plus(e.installment), new Decimal(0));
  return total.toFixed(2, Decimal.ROUND_HALF_UP);
}

/** Série anual para gráficos: um ponto por ano de contrato até termMonths. */
export function buildYearlySeries(
  baseInstallment: string, baseCredit: string, annualRatePercent: string, termMonths: number,
): YearlyPoint[] {
  const points: YearlyPoint[] = [];
  let cumulative = new Decimal(0);
  let lastYearPushed = -1;
  for (let m = 1; m <= termMonths; m++) {
    cumulative = cumulative.plus(correctedInstallmentForMonth(baseInstallment, annualRatePercent, m));
    const isYearEnd = m % 12 === 0 || m === termMonths;
    const year = contractYearOfMonth(m);
    if (isYearEnd && year !== lastYearPushed) {
      points.push({
        year,
        correctedInstallment: calculateCorrectedInstallment(baseInstallment, annualRatePercent, year),
        correctedCredit: new Decimal(baseCredit)
          .times(new Decimal(1).plus(new Decimal(annualRatePercent).div(100)).pow(year))
          .toFixed(2, Decimal.ROUND_HALF_UP),
        cumulativePaid: cumulative.toFixed(2, Decimal.ROUND_HALF_UP),
      });
      lastYearPushed = year;
    }
  }
  return points;
}

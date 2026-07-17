import Decimal from "decimal.js";
import {
  basisInstallment, calculateIncomeCommitment,
  type ClassifiedProduct, type EligibilityBasis,
} from "./index";

export type EligibilitySummary = {
  eligibleCount: number;
  maxPayableCredit: string | null;
  minInstallment: string | null;
  maxCompatibleInstallment: string | null;
  bestSlack: string | null;
  maxCommitmentPercent: string | null;
};

export function summarizeEligibility(
  classified: ClassifiedProduct[],
  basis: EligibilityBasis,
  monthlyIncome: string | null,
): EligibilitySummary {
  if (classified.length === 0) {
    return {
      eligibleCount: 0, maxPayableCredit: null, minInstallment: null,
      maxCompatibleInstallment: null, bestSlack: null, maxCommitmentPercent: null,
    };
  }
  let maxCredit = new Decimal(-1);
  let minInst: Decimal | null = null;
  let maxInst: Decimal | null = null;
  let bestSlack: Decimal | null = null;
  for (const c of classified) {
    const credit = new Decimal(c.product.creditAmount);
    if (credit.gt(maxCredit)) maxCredit = credit;
    const inst = new Decimal(basisInstallment(c.product, basis));
    if (!minInst || inst.lt(minInst)) minInst = inst;
    if (!maxInst || inst.gt(maxInst)) maxInst = inst;
    const slack = new Decimal(c.monthlySlack);
    if (!bestSlack || slack.gt(bestSlack)) bestSlack = slack;
  }
  return {
    eligibleCount: classified.length,
    maxPayableCredit: maxCredit.toFixed(2),
    minInstallment: minInst!.toFixed(2),
    maxCompatibleInstallment: maxInst!.toFixed(2),
    bestSlack: bestSlack!.toFixed(2),
    maxCommitmentPercent: calculateIncomeCommitment(maxInst!.toFixed(2), monthlyIncome),
  };
}

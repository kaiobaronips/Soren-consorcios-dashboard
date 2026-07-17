import Decimal from "decimal.js";

export type EligibilityBasis = "regular" | "first" | "max";
export type Classification = "compatible" | "attention" | "incompatible";

export type EligibilityProduct = {
  id: string;
  productName: string;
  productCode: string;
  administratorName: string;
  category: "property" | "vehicle" | "other";
  creditAmount: string;
  termMonths: number;
  totalAdministrationFeePercent: string;
  first12InstallmentAmount: string | null;
  regularInstallmentAmount: string;
  correctionIndex: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
};

export type ClassifiedProduct = {
  product: EligibilityProduct;
  classification: Classification;
  monthlySlack: string;
  incomeCommitmentPercent: string | null;
};

export function basisInstallment(p: EligibilityProduct, basis: EligibilityBasis): string {
  const regular = new Decimal(p.regularInstallmentAmount);
  const first = p.first12InstallmentAmount ? new Decimal(p.first12InstallmentAmount) : null;
  if (basis === "first") return (first ?? regular).toFixed(2);
  if (basis === "max") return (first && first.gt(regular) ? first : regular).toFixed(2);
  return regular.toFixed(2);
}

export function classifyProduct(p: EligibilityProduct, availableAmount: string): Classification {
  const available = new Decimal(availableAmount);
  const regular = new Decimal(p.regularInstallmentAmount);
  if (regular.gt(available)) return "incompatible";
  const first = p.first12InstallmentAmount ? new Decimal(p.first12InstallmentAmount) : null;
  if (first && first.gt(available)) return "attention";
  return "compatible";
}

export function isEligible(p: EligibilityProduct, availableAmount: string, basis: EligibilityBasis): boolean {
  return new Decimal(basisInstallment(p, basis)).lte(new Decimal(availableAmount));
}

export function calculateMonthlySlack(availableAmount: string, installment: string): string {
  return new Decimal(availableAmount).minus(installment).toFixed(2);
}

export function calculateIncomeCommitment(installment: string, monthlyIncome: string | null): string | null {
  if (!monthlyIncome) return null;
  const income = new Decimal(monthlyIncome);
  if (income.lte(0)) return null;
  return new Decimal(installment).div(income).times(100).toFixed(2);
}

export function getEligibleProducts(
  products: EligibilityProduct[],
  availableAmount: string,
  basis: EligibilityBasis,
  monthlyIncome: string | null,
): ClassifiedProduct[] {
  return products
    .filter((p) => isEligible(p, availableAmount, basis))
    .map((p) => {
      const installment = basisInstallment(p, basis);
      return {
        product: p,
        classification: classifyProduct(p, availableAmount),
        monthlySlack: calculateMonthlySlack(availableAmount, installment),
        incomeCommitmentPercent: calculateIncomeCommitment(installment, monthlyIncome),
      };
    });
}

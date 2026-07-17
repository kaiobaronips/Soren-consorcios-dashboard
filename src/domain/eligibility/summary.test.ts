import { describe, expect, it } from "vitest";
import { getEligibleProducts, type EligibilityProduct } from "./index";
import { summarizeEligibility } from "./summary";

function makeProduct(over: Partial<EligibilityProduct> = {}): EligibilityProduct {
  return {
    id: "p1", productName: "Imóvel IE200 – 200m", productCode: "IE200",
    administratorName: "Não informada (planilha)", category: "property",
    creditAmount: "200000.00", termMonths: 200,
    totalAdministrationFeePercent: "24.800",
    first12InstallmentAmount: "1468.00", regularInstallmentAmount: "1268.00",
    correctionIndex: "IGPM", ...over,
  };
}

describe("summarizeEligibility", () => {
  it("lista vazia → todos os campos null/0", () => {
    const summary = summarizeEligibility([], "regular", "5000.00");
    expect(summary).toEqual({
      eligibleCount: 0,
      maxPayableCredit: null,
      minInstallment: null,
      maxCompatibleInstallment: null,
      bestSlack: null,
      maxCommitmentPercent: null,
    });
  });

  it("resume corretamente 3 produtos elegíveis sintéticos", () => {
    const products = [
      makeProduct({
        id: "a", creditAmount: "100000.00",
        regularInstallmentAmount: "500.00", first12InstallmentAmount: "500.00",
      }),
      makeProduct({
        id: "b", creditAmount: "300000.00",
        regularInstallmentAmount: "1200.00", first12InstallmentAmount: "1200.00",
      }),
      makeProduct({
        id: "c", creditAmount: "200000.00",
        regularInstallmentAmount: "900.00", first12InstallmentAmount: "900.00",
      }),
    ];
    const eligible = getEligibleProducts(products, "1500.00", "regular", "5000.00");
    const summary = summarizeEligibility(eligible, "regular", "5000.00");

    expect(summary.eligibleCount).toBe(3);
    // maior carta entre elegíveis
    expect(summary.maxPayableCredit).toBe("300000.00");
    // menor parcela (basis) entre elegíveis
    expect(summary.minInstallment).toBe("500.00");
    // maior parcela (basis) entre elegíveis
    expect(summary.maxCompatibleInstallment).toBe("1200.00");
    // maior folga: disponível 1500 - menor parcela 500 = 1000.00
    expect(summary.bestSlack).toBe("1000.00");
    // comprometimento da MAIOR parcela elegível (1200.00) vs renda (5000.00) = 24.00%
    expect(summary.maxCommitmentPercent).toBe("24.00");
  });

  it("com apenas 1 produto elegível, min e max de parcela coincidem", () => {
    const products = [
      makeProduct({ id: "a", creditAmount: "150000.00", regularInstallmentAmount: "700.00", first12InstallmentAmount: "700.00" }),
    ];
    const eligible = getEligibleProducts(products, "1000.00", "regular", null);
    const summary = summarizeEligibility(eligible, "regular", null);

    expect(summary.eligibleCount).toBe(1);
    expect(summary.maxPayableCredit).toBe("150000.00");
    expect(summary.minInstallment).toBe("700.00");
    expect(summary.maxCompatibleInstallment).toBe("700.00");
    expect(summary.bestSlack).toBe("300.00");
    expect(summary.maxCommitmentPercent).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  calculateIncomeCommitment, calculateMonthlySlack, classifyProduct,
  getEligibleProducts, isEligible, type EligibilityProduct,
} from "./index";

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

describe("classifyProduct (prompt §10)", () => {
  it("parcela exatamente igual ao disponível é compatível (inclusivo)", () => {
    const p = makeProduct({ regularInstallmentAmount: "1500.00", first12InstallmentAmount: "1500.00" });
    expect(classifyProduct(p, "1500.00")).toBe("compatible");
  });
  it("parcela acima do disponível é incompatível", () => {
    const p = makeProduct({ regularInstallmentAmount: "1500.01" });
    expect(classifyProduct(p, "1500.00")).toBe("incompatible");
  });
  it("recorrente cabe mas 1ª–12ª estoura → atenção (nunca esconder)", () => {
    const p = makeProduct({ regularInstallmentAmount: "1400.00", first12InstallmentAmount: "1600.00" });
    expect(classifyProduct(p, "1500.00")).toBe("attention");
  });
  it("sem first12 cadastrada, compatível se recorrente cabe", () => {
    const p = makeProduct({ first12InstallmentAmount: null, regularInstallmentAmount: "1400.00" });
    expect(classifyProduct(p, "1500.00")).toBe("compatible");
  });
});

describe("isEligible por basis", () => {
  const p = makeProduct({ regularInstallmentAmount: "1400.00", first12InstallmentAmount: "1600.00" });
  it("basis regular: só a recorrente importa", () => {
    expect(isEligible(p, "1500.00", "regular")).toBe(true);
  });
  it("basis first: a 1ª–12ª importa", () => {
    expect(isEligible(p, "1500.00", "first")).toBe(false);
  });
  it("basis max: maior das duas importa", () => {
    expect(isEligible(p, "1500.00", "max")).toBe(false);
    expect(isEligible(p, "1600.00", "max")).toBe(true);
  });
});

describe("folga e comprometimento", () => {
  it("folga mensal com precisão decimal", () => {
    expect(calculateMonthlySlack("1500.00", "1458.20")).toBe("41.80");
    expect(calculateMonthlySlack("1500.00", "1600.00")).toBe("-100.00");
  });
  it("comprometimento de renda em pontos percentuais, 2 casas", () => {
    expect(calculateIncomeCommitment("1268.00", "5000.00")).toBe("25.36");
    expect(calculateIncomeCommitment("1268.00", null)).toBeNull();
    expect(calculateIncomeCommitment("1268.00", "0.00")).toBeNull();
  });
});

describe("getEligibleProducts", () => {
  it("cliente sem produtos elegíveis retorna lista vazia", () => {
    const products = [makeProduct({ regularInstallmentAmount: "900.00" })];
    expect(getEligibleProducts(products, "800.00", "regular", null)).toHaveLength(0);
  });
  it("inclui attention quando basis=regular e ordena nada (ordem de entrada)", () => {
    const attention = makeProduct({ id: "a", regularInstallmentAmount: "1400.00", first12InstallmentAmount: "1600.00" });
    const result = getEligibleProducts([attention], "1500.00", "regular", "3000.00");
    expect(result).toHaveLength(1);
    expect(result[0].classification).toBe("attention");
    expect(result[0].monthlySlack).toBe("100.00");
    expect(result[0].incomeCommitmentPercent).toBe("46.67");
  });
});

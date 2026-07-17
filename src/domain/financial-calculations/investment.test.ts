import { describe, expect, it } from "vitest";
import {
  applySimpleNetDiscount,
  calculateCompoundFutureValue, calculateMonthlyContributionFutureValue,
  cdiEffectiveAnnualRate, monthlyEquivalentRate,
} from "./investment";

describe("monthlyEquivalentRate", () => {
  it("10,5% a.a. → taxa mensal equivalente (8 casas)", () => {
    expect(monthlyEquivalentRate("10.5")).toBe("0.00835516");
  });
  it("taxa zero → 0", () => {
    expect(monthlyEquivalentRate("0")).toBe("0.00000000");
  });
});

describe("calculateMonthlyContributionFutureValue (caso 12: taxa zero)", () => {
  it("taxa zero → aporte × meses", () => {
    expect(calculateMonthlyContributionFutureValue("1000.00", "0", 24)).toBe("24000.00");
  });
});

describe("calculateMonthlyContributionFutureValue (caso 13: taxa positiva)", () => {
  it("aporte 1.000, 10,5% a.a., 12 meses (FV fim de mês)", () => {
    // taxa_mensal = 1.105^(1/12)-1 ≈ 0.00836484; FV = 1000 × ((1+i)^12 - 1)/i = 12567.09
    expect(calculateMonthlyContributionFutureValue("1000.00", "10.5", 12)).toBe("12567.09");
  });
});

describe("calculateCompoundFutureValue (caso 11: CDI juros compostos)", () => {
  it("10.000 a 10,5% a.a. por 2 anos", () => {
    // 10000 × 1.105^2 = 12210.25
    expect(calculateCompoundFutureValue("10000.00", "10.5", "2")).toBe("12210.25");
  });
  it("taxa zero mantém o capital", () => {
    expect(calculateCompoundFutureValue("10000.00", "0", "5")).toBe("10000.00");
  });
});

describe("cdiEffectiveAnnualRate (prompt §17)", () => {
  it("110% do CDI de 10,5% = 11,55%", () => {
    expect(cdiEffectiveAnnualRate("10.5", "110")).toBe("11.5500");
  });
});

describe("applySimpleNetDiscount", () => {
  it("desconta IR sobre o rendimento e taxa adm sobre o bruto", () => {
    // bruto 12210.25, rendimento 2210.25, IR 15% = 331.5375, taxa adm 1% de 12210.25 = 122.1025
    // líquido = 12210.25 - 331.5375 - 122.1025 = 11756.61
    expect(applySimpleNetDiscount("12210.25", "2210.25", "15", "1")).toBe("11756.61");
  });
  it("sem desconto (0/0) mantém o bruto", () => {
    expect(applySimpleNetDiscount("12210.25", "2210.25", "0", "0")).toBe("12210.25");
  });
  it("nunca fica negativo mesmo com descontos exagerados", () => {
    expect(applySimpleNetDiscount("100.00", "100.00", "90", "50")).toBe("0.00");
  });
});

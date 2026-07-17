import { describe, expect, it } from "vitest";
import {
  calculateCompoundFutureValue, calculateMonthlyContributionFutureValue,
  cdiEffectiveAnnualRate, monthlyEquivalentRate,
} from "./investment";

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

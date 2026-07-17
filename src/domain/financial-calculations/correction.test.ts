import { describe, expect, it } from "vitest";
import {
  annualCorrectionFactor, calculateCorrectedCredit, calculateCorrectedInstallment,
  contractYearOfMonth, correctedInstallmentForMonth,
} from "./correction";

describe("contractYearOfMonth (prompt §14)", () => {
  it("mês 1–12 → ano 0; mês 13 → ano 1; mês 240 → ano 19", () => {
    expect(contractYearOfMonth(1)).toBe(0);
    expect(contractYearOfMonth(12)).toBe(0);
    expect(contractYearOfMonth(13)).toBe(1);
    expect(contractYearOfMonth(240)).toBe(19);
  });
});

describe("annualCorrectionFactor", () => {
  it("ano 0 = 1 (sem correção)", () => {
    expect(annualCorrectionFactor("6.5", 0)).toBe("1.000000");
  });
  it("IGP-M 6,5% no ano 1 e 2", () => {
    expect(annualCorrectionFactor("6.5", 1)).toBe("1.065000");
    expect(annualCorrectionFactor("6.5", 2)).toBe("1.134225");
  });
  it("taxa zero mantém fator 1 em qualquer ano (caso 10 do prompt)", () => {
    expect(annualCorrectionFactor("0", 8)).toBe("1.000000");
  });
});

describe("calculateCorrectedCredit (caso 8: IGP-M)", () => {
  it("carta 600.000 corrigida por IGP-M 6,5% no ano 8", () => {
    // 600000 × 1.065^8 = 992997.40
    expect(calculateCorrectedCredit("600000.00", "6.5", 8)).toBe("992997.40");
  });
  it("taxa zero não altera a carta (caso 10)", () => {
    expect(calculateCorrectedCredit("600000.00", "0", 8)).toBe("600000.00");
  });
});

describe("calculateCorrectedInstallment (caso 9: IPCA)", () => {
  it("parcela 1.902 corrigida por IPCA 4,5% no ano 3", () => {
    // 1902 × 1.045^3 = 1902 × 1.141166... = 2170.50
    expect(calculateCorrectedInstallment("1902.00", "4.5", 3)).toBe("2170.50");
  });
});

describe("correctedInstallmentForMonth", () => {
  it("mês 1 usa ano 0 (parcela base)", () => {
    expect(correctedInstallmentForMonth("1902.00", "4.5", 1)).toBe("1902.00");
  });
  it("mês 13 usa ano 1", () => {
    expect(correctedInstallmentForMonth("1902.00", "4.5", 13)).toBe("1987.59");
  });
});

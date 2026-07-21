import { describe, expect, it } from "vitest";
import { accumulateMonthlyToAnnual, annualizeDailyRate } from "./normalize";

describe("accumulateMonthlyToAnnual", () => {
  it("12 meses de 0,5% → 6,1678% a.a.", () => {
    expect(accumulateMonthlyToAnnual(Array(12).fill("0.5"))).toBe("6.1678");
  });
  it("meses variados (inclui deflação) acumulam corretamente", () => {
    const ms = ["0.62", "0.40", "-0.10", "0.55", "0.30", "0.20", "0.45", "0.50", "0.38", "0.42", "0.60", "0.28"];
    expect(accumulateMonthlyToAnnual(ms)).toBe("4.6960");
  });
});

describe("annualizeDailyRate", () => {
  it("0,041% ao dia (base 252) → 10,8823% a.a.", () => {
    expect(annualizeDailyRate("0.041")).toBe("10.8823");
  });
  it("taxa zero mantém 0", () => {
    expect(annualizeDailyRate("0")).toBe("0.0000");
  });
});

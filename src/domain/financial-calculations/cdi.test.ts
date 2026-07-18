import { describe, expect, it } from "vitest";
import { cdiCompoundProjection, type CdiProjectionInput } from "./cdi";

function baseInput(over: Partial<CdiProjectionInput> = {}): CdiProjectionInput {
  return {
    cdiAnnualRatePercent: "10.5",
    cdiPercentage: "110",
    monthlyContribution: "1000.00",
    initialAmount: "5000.00",
    years: 2,
    creditAmount: "200000.00",
    consortiumAnnualRatePercent: "6.5",
    ...over,
  };
}

describe("cdiCompoundProjection (prompt §17)", () => {
  it("110% do CDI de 10,5% → taxa efetiva 11,55%", () => {
    expect(cdiCompoundProjection(baseInput()).effectiveAnnualRatePercent).toBe("11.5500");
  });

  it("combina aporte mensal + capital inicial (bruto, sem desconto)", () => {
    const p = cdiCompoundProjection(baseInput());
    expect(p.totalContributed).toBe("29000.00"); // 1000×24 + 5000
    expect(p.grossAmount).toBe("32925.05");
    expect(p.earnings).toBe("3925.05");
    expect(p.netAmount).toBe("32925.05"); // sem desconto, líquido = bruto
    expect(p.displayAmount).toBe("32925.05");
  });

  it("compara com a carta corrigida por ANO INTEIRO (IGP-M 6,5% no ano 2)", () => {
    const p = cdiCompoundProjection(baseInput());
    expect(p.correctedCredit).toBe("226845.00"); // 200000 × 1.065^2
    expect(p.differenceVsCredit).toBe("-193919.95");
  });

  it("desconto de IR sobre o rendimento reduz o montante exibido", () => {
    const p = cdiCompoundProjection(baseInput({ discount: { irRatePercent: "15", adminFeeRatePercent: "0" } }));
    expect(p.netAmount).toBe("32336.29"); // 32925.05 − 15% de 3925.05
    expect(p.displayAmount).toBe("32336.29");
    expect(p.differenceVsCredit).toBe("-194508.71");
  });

  it("série anual tem um ponto por ano, com carta corrigida por ano inteiro e saldo crescente", () => {
    const p = cdiCompoundProjection(baseInput());
    expect(p.yearly).toHaveLength(2);
    expect(p.yearly[0].year).toBe(1);
    expect(p.yearly[1].year).toBe(2);
    expect(p.yearly[0].correctedCredit).toBe("213000.00"); // 200000 × 1.065^1
    expect(p.yearly[1].correctedCredit).toBe("226845.00"); // 200000 × 1.065^2
    // saldo do ano 2 > saldo do ano 1
    expect(Number(p.yearly[1].balance)).toBeGreaterThan(Number(p.yearly[0].balance));
    // último ponto anual coincide com o montante bruto exibido
    expect(p.yearly[1].balance).toBe(p.displayAmount);
  });
});

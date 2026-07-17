import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateCorrectedCredit } from "./correction";
import { compareConsortiumAndInvestments } from "./comparison";
import { calculateCompoundFutureValue, calculateMonthlyContributionFutureValue } from "./investment";

describe("compareConsortiumAndInvestments — Modo A (aporte mensal)", () => {
  const input = {
    mode: "monthly_contribution" as const,
    monthlyInstallment: "1000.00",
    creditAmount: "600000.00",
    months: 24,
    investmentAnnualRatePercent: "10.5",
    consortiumAnnualRatePercent: "6.5",
  };

  it("totalContributed = parcela × meses", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.totalContributed).toBe(
      new Decimal(input.monthlyInstallment).times(input.months).toFixed(2, Decimal.ROUND_HALF_UP),
    );
    expect(result.totalContributed).toBe("24000.00");
  });

  it("investmentGross bate com calculateMonthlyContributionFutureValue", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.investmentGross).toBe(
      calculateMonthlyContributionFutureValue(input.monthlyInstallment, input.investmentAnnualRatePercent, input.months),
    );
  });

  it("investmentEarnings = investmentGross − totalContributed", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.investmentEarnings).toBe(
      new Decimal(result.investmentGross).minus(result.totalContributed).toFixed(2, Decimal.ROUND_HALF_UP),
    );
  });

  it("correctedCredit bate com calculateCorrectedCredit(floor(meses/12))", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.correctedCredit).toBe(
      calculateCorrectedCredit(input.creditAmount, input.consortiumAnnualRatePercent, Math.floor(input.months / 12)),
    );
  });

  it("differenceVsCredit = investmentGross − correctedCredit", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.differenceVsCredit).toBe(
      new Decimal(result.investmentGross).minus(result.correctedCredit).toFixed(2, Decimal.ROUND_HALF_UP),
    );
  });

  it("mode é preservado no resultado", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.mode).toBe("monthly_contribution");
  });
});

describe("compareConsortiumAndInvestments — Modo B (capital inicial)", () => {
  const input = {
    mode: "initial_capital" as const,
    monthlyInstallment: "1000.00",
    creditAmount: "600000.00",
    months: 24,
    investmentAnnualRatePercent: "10.5",
    consortiumAnnualRatePercent: "6.5",
  };

  it("totalContributed = capital inicial (creditAmount)", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.totalContributed).toBe("600000.00");
  });

  it("investmentGross bate com calculateCompoundFutureValue (years = meses/12)", () => {
    const result = compareConsortiumAndInvestments(input);
    const years = new Decimal(input.months).div(12).toString();
    expect(result.investmentGross).toBe(
      calculateCompoundFutureValue(input.creditAmount, input.investmentAnnualRatePercent, years),
    );
  });

  it("investmentEarnings = investmentGross − totalContributed", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.investmentEarnings).toBe(
      new Decimal(result.investmentGross).minus(result.totalContributed).toFixed(2, Decimal.ROUND_HALF_UP),
    );
  });

  it("correctedCredit bate com calculateCorrectedCredit(floor(meses/12))", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.correctedCredit).toBe(
      calculateCorrectedCredit(input.creditAmount, input.consortiumAnnualRatePercent, Math.floor(input.months / 12)),
    );
  });

  it("differenceVsCredit = investmentGross − correctedCredit", () => {
    const result = compareConsortiumAndInvestments(input);
    expect(result.differenceVsCredit).toBe(
      new Decimal(result.investmentGross).minus(result.correctedCredit).toFixed(2, Decimal.ROUND_HALF_UP),
    );
  });
});

describe("compareConsortiumAndInvestments — série anual", () => {
  it("Modo A: um ponto por ano completo, último ponto bate com o total do período (meses múltiplo de 12)", () => {
    const input = {
      mode: "monthly_contribution" as const,
      monthlyInstallment: "1000.00",
      creditAmount: "600000.00",
      months: 24,
      investmentAnnualRatePercent: "10.5",
      consortiumAnnualRatePercent: "6.5",
    };
    const result = compareConsortiumAndInvestments(input);

    expect(result.yearly).toHaveLength(2);
    expect(result.yearly[0]?.year).toBe(1);
    expect(result.yearly[1]?.year).toBe(2);

    // Ponto do ano 1 (12 meses de aporte)
    expect(result.yearly[0]?.invested).toBe(
      new Decimal(input.monthlyInstallment).times(12).toFixed(2, Decimal.ROUND_HALF_UP),
    );
    expect(result.yearly[0]?.investmentBalance).toBe(
      calculateMonthlyContributionFutureValue(input.monthlyInstallment, input.investmentAnnualRatePercent, 12),
    );
    expect(result.yearly[0]?.correctedCredit).toBe(
      calculateCorrectedCredit(input.creditAmount, input.consortiumAnnualRatePercent, 1),
    );

    // Último ponto (ano 2 = 24 meses) deve bater com os totais do resultado
    expect(result.yearly[1]?.invested).toBe(result.totalContributed);
    expect(result.yearly[1]?.investmentBalance).toBe(result.investmentGross);
    expect(result.yearly[1]?.correctedCredit).toBe(result.correctedCredit);
  });

  it("Modo B: invested constante = capital inicial em todos os pontos", () => {
    const input = {
      mode: "initial_capital" as const,
      monthlyInstallment: "1000.00",
      creditAmount: "600000.00",
      months: 24,
      investmentAnnualRatePercent: "10.5",
      consortiumAnnualRatePercent: "6.5",
    };
    const result = compareConsortiumAndInvestments(input);

    expect(result.yearly).toHaveLength(2);
    for (const point of result.yearly) {
      expect(point.invested).toBe("600000.00");
    }
    expect(result.yearly[1]?.investmentBalance).toBe(result.investmentGross);
    expect(result.yearly[1]?.correctedCredit).toBe(result.correctedCredit);
  });

  it("período com ano parcial (meses não múltiplo de 12) gera ponto final parcial coerente", () => {
    const input = {
      mode: "monthly_contribution" as const,
      monthlyInstallment: "1000.00",
      creditAmount: "600000.00",
      months: 30,
      investmentAnnualRatePercent: "10.5",
      consortiumAnnualRatePercent: "6.5",
    };
    const result = compareConsortiumAndInvestments(input);

    expect(result.yearly).toHaveLength(3);
    expect(result.yearly[0]?.year).toBe(1);
    expect(result.yearly[1]?.year).toBe(2);
    expect(result.yearly[2]?.year).toBe(2.5);

    expect(result.yearly[2]?.invested).toBe(
      new Decimal(input.monthlyInstallment).times(30).toFixed(2, Decimal.ROUND_HALF_UP),
    );
    expect(result.yearly[2]?.investmentBalance).toBe(
      calculateMonthlyContributionFutureValue(input.monthlyInstallment, input.investmentAnnualRatePercent, 30),
    );
  });
});

describe("compareConsortiumAndInvestments — caso taxa zero", () => {
  it("Modo A com taxa de investimento zero: gross = total aportado; correção zero mantém a carta", () => {
    const input = {
      mode: "monthly_contribution" as const,
      monthlyInstallment: "1000.00",
      creditAmount: "600000.00",
      months: 12,
      investmentAnnualRatePercent: "0",
      consortiumAnnualRatePercent: "0",
    };
    const result = compareConsortiumAndInvestments(input);

    expect(result.investmentGross).toBe(result.totalContributed);
    expect(result.investmentGross).toBe("12000.00");
    expect(result.investmentEarnings).toBe("0.00");
    expect(result.correctedCredit).toBe("600000.00");
    expect(result.differenceVsCredit).toBe(
      new Decimal(result.investmentGross).minus(result.correctedCredit).toFixed(2, Decimal.ROUND_HALF_UP),
    );
  });

  it("Modo B com taxa de investimento zero: gross mantém o capital inicial", () => {
    const input = {
      mode: "initial_capital" as const,
      monthlyInstallment: "1000.00",
      creditAmount: "600000.00",
      months: 12,
      investmentAnnualRatePercent: "0",
      consortiumAnnualRatePercent: "0",
    };
    const result = compareConsortiumAndInvestments(input);

    expect(result.investmentGross).toBe("600000.00");
    expect(result.investmentEarnings).toBe("0.00");
    expect(result.correctedCredit).toBe("600000.00");
    expect(result.differenceVsCredit).toBe("0.00");
  });
});

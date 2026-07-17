import { describe, expect, it } from "vitest";
import {
  buildYearlySeries, calculateCorrectedPaymentSchedule, calculateTotalProjectedPayments,
} from "./schedule";

describe("calculateTotalProjectedPayments (total pago = soma parcela a parcela)", () => {
  it("taxa zero: parcela 1.000 × 12 meses = 12000.00", () => {
    expect(calculateTotalProjectedPayments("1000.00", "0", 12)).toBe("12000.00");
  });

  it("IGP-M 6,5%, 24 meses: soma dos 12 primeiros meses na parcela base + 12 seguintes corrigidos", () => {
    // meses 1-12 (ano 0): 12 × 1000.00 = 12000.00
    // meses 13-24 (ano 1): parcela = 1000 × 1.065 = 1065.00 → 12 × 1065.00 = 12780.00
    // total = 12000.00 + 12780.00 = 24780.00
    const total = calculateTotalProjectedPayments("1000.00", "6.5", 24);
    expect(total).toBe("24780.00");
    // nunca deve ser última parcela × prazo (1065.00 × 24 = 25560.00)
    expect(total).not.toBe("25560.00");
  });
});

describe("calculateCorrectedPaymentSchedule (caso 14: limite pelo prazo)", () => {
  it("untilMonth maior que termMonths é limitado a termMonths", () => {
    const schedule = calculateCorrectedPaymentSchedule("1000.00", "6.5", 12, 999);
    expect(schedule).toHaveLength(12);
    expect(schedule[schedule.length - 1].month).toBe(12);
  });

  it("sem untilMonth, gera o cronograma completo até termMonths", () => {
    const schedule = calculateCorrectedPaymentSchedule("1000.00", "6.5", 12);
    expect(schedule).toHaveLength(12);
  });

  it("untilMonth menor que termMonths limita o cronograma a untilMonth", () => {
    const schedule = calculateCorrectedPaymentSchedule("1000.00", "6.5", 24, 6);
    expect(schedule).toHaveLength(6);
  });
});

describe("calculateCorrectedPaymentSchedule (taxa zero)", () => {
  it("todas as parcelas iguais à base quando a taxa é zero", () => {
    const schedule = calculateCorrectedPaymentSchedule("500.00", "0", 5);
    expect(schedule).toEqual([
      { month: 1, year: 0, installment: "500.00" },
      { month: 2, year: 0, installment: "500.00" },
      { month: 3, year: 0, installment: "500.00" },
      { month: 4, year: 0, installment: "500.00" },
      { month: 5, year: 0, installment: "500.00" },
    ]);
  });
});

describe("buildYearlySeries", () => {
  it("termMonths=240 gera exatamente 20 pontos (anos 0–19), sem duplicar o último ano", () => {
    const series = buildYearlySeries("1000.00", "100000.00", "5", 240);
    expect(series).toHaveLength(20);
    expect(series.map((p) => p.year)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("cumulativePaid é crescente e monotônico", () => {
    const series = buildYearlySeries("1000.00", "100000.00", "5", 240);
    for (let i = 1; i < series.length; i++) {
      expect(Number(series[i].cumulativePaid)).toBeGreaterThan(Number(series[i - 1].cumulativePaid));
    }
  });

  it("primeiro ponto (ano 0) reflete os 12 primeiros meses sem correção", () => {
    const series = buildYearlySeries("1000.00", "100000.00", "5", 240);
    expect(series[0]).toEqual({
      year: 0, correctedInstallment: "1000.00", correctedCredit: "100000.00", cumulativePaid: "12000.00",
    });
  });

  it("último ponto = total do plano (soma de todas as parcelas até termMonths)", () => {
    const series = buildYearlySeries("1000.00", "100000.00", "5", 240);
    const last = series[series.length - 1];
    const total = calculateTotalProjectedPayments("1000.00", "5", 240);
    expect(last.cumulativePaid).toBe(total);
    expect(last).toEqual({
      year: 19, correctedInstallment: "2526.95", correctedCredit: "252695.02", cumulativePaid: "396791.64",
    });
  });

  it("termMonths múltiplo de 12 não duplica ponto do último ano (24 meses → 2 pontos, anos 0 e 1)", () => {
    const series = buildYearlySeries("1000.00", "100000.00", "6.5", 24);
    expect(series).toHaveLength(2);
    expect(series.map((p) => p.year)).toEqual([0, 1]);
  });
});

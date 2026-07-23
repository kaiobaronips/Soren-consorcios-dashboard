import { describe, expect, it } from "vitest";
import {
  selectPreferredIndexes,
  type FinancialIndexRow,
} from "./indexes";

function row(overrides: Partial<FinancialIndexRow> = {}): FinancialIndexRow {
  return {
    index_code: "CDI",
    annual_rate: 14.15,
    reference_period: "2026-07-01",
    source: "Banco Central (SGS)",
    projected: false,
    updated_at: "2026-07-23T12:00:00.000Z",
    ...overrides,
  };
}

describe("selectPreferredIndexes", () => {
  it("prioriza a taxa oficial sobre uma projeção atualizada depois", () => {
    const indexes = selectPreferredIndexes([
      row(),
      row({
        annual_rate: 10.5,
        source: "Taxa projetada configurada pelo administrador",
        projected: true,
        updated_at: "2026-07-24T12:00:00.000Z",
      }),
    ]);

    expect(indexes.CDI).toMatchObject({
      annualRatePercent: "14.1500",
      source: "Banco Central (SGS)",
      projected: false,
    });
  });

  it("usa o registro mais recente entre dados do mesmo tipo", () => {
    const indexes = selectPreferredIndexes([
      row({ annual_rate: 14.05, updated_at: "2026-07-22T12:00:00.000Z" }),
      row({ annual_rate: 14.15, updated_at: "2026-07-23T12:00:00.000Z" }),
    ]);

    expect(indexes.CDI?.annualRatePercent).toBe("14.1500");
  });
});

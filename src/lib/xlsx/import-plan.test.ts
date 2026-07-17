import { describe, expect, it } from "vitest";
import { dedupKey, planImport } from "./import-plan";
import type { ParsedProduct } from "./parse-consorcio";

const base: ParsedProduct = {
  productName: "Imóvel IE600 – 240m",
  productCode: "IE600",
  creditAmount: "600000.00",
  termMonths: 240,
  totalAdministrationFeePercent: "26.800",
  first12InstallmentAmount: "3820.00",
  regularInstallmentAmount: "3220.00",
};

describe("dedupKey", () => {
  it("é estável por código+prazo+carta", () => {
    expect(dedupKey(base)).toBe("IE600|240|600000.00");
  });
});

describe("planImport", () => {
  it("tudo novo → insere tudo", () => {
    const plan = planImport([base], []);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(0);
  });

  it("reimportação idêntica → tudo unchanged (idempotência)", () => {
    const plan = planImport([base], [{ ...base, id: "x1" }]);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(1);
  });

  it("mesma chave com campo alterado → update", () => {
    const changed = { ...base, regularInstallmentAmount: "3200.00" };
    const plan = planImport([changed], [{ ...base, id: "x1" }]);
    expect(plan.toUpdate).toEqual([{ id: "x1", data: changed }]);
    expect(plan.toInsert).toHaveLength(0);
  });
});

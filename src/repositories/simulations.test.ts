import { describe, expect, it } from "vitest";
import { computeSimulation, toProductSnapshot, type SimulationSnapshotInput } from "./simulations";
import type { Product } from "./products";
import type { SimulationAssumptions } from "@/domain/financial-calculations";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-a",
    productName: "Imóvel 600k",
    productCode: "IMV-600",
    administratorName: "Administradora A",
    category: "property",
    creditAmount: "600000.00",
    termMonths: 180,
    totalAdministrationFeePercent: "26.800",
    first12InstallmentAmount: null,
    regularInstallmentAmount: "3220.00",
    correctionIndex: "IGPM",
    status: "active",
    isDemo: false,
    sourceDocumentId: null,
    sourcePage: null,
    extractionConfidence: null,
    ...overrides,
  };
}

function baseAssumptions(overrides: Partial<SimulationAssumptions> = {}): SimulationAssumptions {
  return {
    scenario: "base",
    indexCode: "IGPM",
    annualRatePercent: "6.5",
    rateOrigin: "manual",
    rateUpdatedAt: "2026-07-01",
    rateType: "manual",
    adjustmentFrequencyMonths: 12,
    ...overrides,
  };
}

describe("computeSimulation (pura)", () => {
  it("é determinística: mesma entrada produz sempre a mesma saída", () => {
    const input: SimulationSnapshotInput = {
      product: toProductSnapshot(baseProduct()),
      assumptions: baseAssumptions(),
      selectedMonth: 97, // ano 8
    };
    const r1 = computeSimulation(input);
    const r2 = computeSimulation(input);
    expect(r1).toEqual(r2);
  });

  it("calcula selectedYear, carta e parcela projetadas usando o domínio (Tasks 1-2)", () => {
    const input: SimulationSnapshotInput = {
      product: toProductSnapshot(baseProduct({ creditAmount: "600000.00", regularInstallmentAmount: "3220.00" })),
      assumptions: baseAssumptions({ annualRatePercent: "6.5" }),
      selectedMonth: 97, // contractYearOfMonth(97) = 8
    };
    const result = computeSimulation(input);
    expect(result.selectedYear).toBe(8);
    expect(result.baseCreditAmount).toBe("600000.00");
    // 600000 × 1.065^8 = 992997.40 (mesmo caso 8 do domínio de correção)
    expect(result.projectedCreditAmount).toBe("992997.40");
    expect(result.baseInstallmentAmount).toBe("3220.00");
    // sem taxa CDI no input, a comparação fica sem valor
    expect(result.cdiComparisonValue).toBeNull();
  });

  it("calcula cdiComparisonValue quando a taxa CDI é capturada no snapshot (§16 Modo A)", () => {
    const input: SimulationSnapshotInput = {
      product: toProductSnapshot(baseProduct({ creditAmount: "600000.00", regularInstallmentAmount: "3220.00" })),
      assumptions: baseAssumptions({ annualRatePercent: "6.5" }),
      selectedMonth: 97,
      cdiAnnualRatePercent: "10.5",
    };
    // FV da parcela 3220 investida ao CDI 10,5% a.a. por 97 meses (aporte fim de mês)
    expect(computeSimulation(input).cdiComparisonValue).toBe("478409.07");
  });
});

describe("toProductSnapshot (caso 19 — montagem do snapshot no momento do save)", () => {
  it("captura os valores do produto no instante da chamada, sem depender de estado externo", () => {
    const productAtSaveTime = baseProduct({ creditAmount: "600000.00", regularInstallmentAmount: "3220.00" });
    const snapshot = toProductSnapshot(productAtSaveTime);
    expect(snapshot).toEqual({
      id: "product-a",
      productName: "Imóvel 600k",
      creditAmount: "600000.00",
      termMonths: 180,
      regularInstallmentAmount: "3220.00",
      first12InstallmentAmount: null,
      totalAdministrationFeePercent: "26.800",
      correctionIndex: "IGPM",
    });
  });

  it("dois produtos com valores diferentes geram snapshots diferentes", () => {
    const productA = baseProduct({ id: "product-a", creditAmount: "600000.00" });
    const productB = baseProduct({ id: "product-b", creditAmount: "900000.00" });
    expect(toProductSnapshot(productA)).not.toEqual(toProductSnapshot(productB));
  });
});

describe("Imutabilidade do snapshot (caso 20)", () => {
  it("recomputar a partir do product_snapshot gravado dá o MESMO resultado mesmo que o produto atual tenha mudado", () => {
    // Produto no momento em que a simulação foi salva.
    const productAtSaveTime = baseProduct({
      id: "product-a", creditAmount: "600000.00", regularInstallmentAmount: "3220.00",
    });
    const assumptionsAtSaveTime = baseAssumptions({ annualRatePercent: "6.5" });
    const selectedMonth = 97;

    // O que fica gravado como product_snapshot / assumptions_snapshot.
    const storedSnapshot: SimulationSnapshotInput = {
      product: toProductSnapshot(productAtSaveTime),
      assumptions: assumptionsAtSaveTime,
      selectedMonth,
    };
    const originalResult = computeSimulation(storedSnapshot);

    // Depois, o produto "atual" no catálogo mudou (reajuste, correção de cadastro, etc.).
    const productNow = baseProduct({
      id: "product-a", creditAmount: "750000.00", regularInstallmentAmount: "4100.00",
      totalAdministrationFeePercent: "30.000",
    });
    // Prova de que o "produto atual" é de fato diferente do que está no snapshot.
    expect(toProductSnapshot(productNow)).not.toEqual(storedSnapshot.product);

    // Recomputar a simulação SEMPRE a partir do snapshot gravado (nunca do produto atual)
    // deve reproduzir exatamente o mesmo resultado — essa é a garantia de imutabilidade.
    const recomputedFromSnapshot = computeSimulation(storedSnapshot);
    expect(recomputedFromSnapshot).toEqual(originalResult);

    // E, para deixar explícito o contraste: recomputar com o produto atual dá outro resultado.
    const resultWithCurrentProduct = computeSimulation({
      product: toProductSnapshot(productNow),
      assumptions: assumptionsAtSaveTime,
      selectedMonth,
    });
    expect(resultWithCurrentProduct).not.toEqual(originalResult);
  });
});

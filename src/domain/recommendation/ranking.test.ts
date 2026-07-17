import { describe, expect, it } from "vitest";
import type { ClassifiedProduct, EligibilityProduct } from "../eligibility";
import { rankConsortiumProducts, type RankingPreferences } from "./index";

function makeClassified(over: Partial<EligibilityProduct> = {}, classification: ClassifiedProduct["classification"] = "compatible", monthlySlack = "100.00"): ClassifiedProduct {
  const product: EligibilityProduct = {
    id: over.id ?? "p1",
    productName: over.productName ?? "Imóvel IE200 – 200m",
    productCode: over.productCode ?? "IE200",
    administratorName: over.administratorName ?? "Não informada (planilha)",
    category: over.category ?? "property",
    creditAmount: over.creditAmount ?? "200000.00",
    termMonths: over.termMonths ?? 200,
    totalAdministrationFeePercent: over.totalAdministrationFeePercent ?? "24.800",
    first12InstallmentAmount: over.first12InstallmentAmount ?? "1468.00",
    regularInstallmentAmount: over.regularInstallmentAmount ?? "1268.00",
    correctionIndex: over.correctionIndex ?? "IGPM",
  };
  return {
    product,
    classification,
    monthlySlack,
    incomeCommitmentPercent: null,
  };
}

const noPrefs: RankingPreferences = { desiredCategory: "all", desiredTermMonths: null };

describe("rankConsortiumProducts (prompt teste 5)", () => {
  it("ranking por maior carta: dois produtos compatible com mesma folga/taxa/prazo → maior carta primeiro e score maior", () => {
    const menor = makeClassified({ id: "menor", productCode: "A100", creditAmount: "100000.00" });
    const maior = makeClassified({ id: "maior", productCode: "A200", creditAmount: "200000.00" });
    const { ranked } = rankConsortiumProducts([menor, maior], noPrefs, "regular");
    expect(ranked[0].product.id).toBe("maior");
    expect(ranked[1].product.id).toBe("menor");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("attention perde para compatible de carta igual", () => {
    const compatible = makeClassified({ id: "compat", productCode: "B100" }, "compatible");
    const attention = makeClassified({ id: "attn", productCode: "B200" }, "attention");
    const { ranked } = rankConsortiumProducts([attention, compatible], noPrefs, "regular");
    expect(ranked[0].product.id).toBe("compat");
    expect(ranked[1].product.id).toBe("attn");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("categoria desejada pontua: vehicle pedido → produto vehicle na frente de property equivalente", () => {
    const property = makeClassified({ id: "prop", productCode: "C100", category: "property" });
    const vehicle = makeClassified({ id: "veh", productCode: "C200", category: "vehicle" });
    const prefs: RankingPreferences = { desiredCategory: "vehicle", desiredTermMonths: null };
    const { ranked } = rankConsortiumProducts([property, vehicle], prefs, "regular");
    expect(ranked[0].product.id).toBe("veh");
    expect(ranked[1].product.id).toBe("prop");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("reasons somam o score (tolerância 0.1)", () => {
    const a = makeClassified({ id: "a", productCode: "D100", creditAmount: "150000.00" }, "attention", "50.00");
    const b = makeClassified({ id: "b", productCode: "D200", creditAmount: "250000.00" }, "compatible", "300.00");
    const prefs: RankingPreferences = { desiredCategory: "property", desiredTermMonths: 180 };
    const { ranked } = rankConsortiumProducts([a, b], prefs, "regular");
    for (const item of ranked) {
      const sum = item.reasons.reduce((acc, r) => acc + r.points, 0);
      expect(Math.abs(sum - item.score)).toBeLessThanOrEqual(0.1);
    }
  });

  it("highlights corretos (biggestCredit/lowestInstallment/shortestTerm/lowestFee/bestBalance) num conjunto de 3 produtos distintos", () => {
    const p1 = makeClassified({
      id: "p1", productCode: "E100", creditAmount: "300000.00", termMonths: 220,
      totalAdministrationFeePercent: "26.800", regularInstallmentAmount: "1800.00", first12InstallmentAmount: "1800.00",
    });
    const p2 = makeClassified({
      id: "p2", productCode: "E200", creditAmount: "100000.00", termMonths: 120,
      totalAdministrationFeePercent: "18.500", regularInstallmentAmount: "900.00", first12InstallmentAmount: "900.00",
    });
    const p3 = makeClassified({
      id: "p3", productCode: "E300", creditAmount: "200000.00", termMonths: 160,
      totalAdministrationFeePercent: "22.000", regularInstallmentAmount: "1200.00", first12InstallmentAmount: "1200.00",
    });
    const { highlights } = rankConsortiumProducts([p1, p2, p3], noPrefs, "regular");
    expect(highlights.biggestCredit).toBe("p1");
    expect(highlights.lowestInstallment).toBe("p2");
    expect(highlights.shortestTerm).toBe("p2");
    expect(highlights.lowestFee).toBe("p2");
    // bestBalance: maior (carta ÷ parcela): p1=166.67, p2=111.11, p3=166.67 -> primeiro encontrado (p1)
    expect(highlights.bestBalance).toBe("p1");
  });

  it("determinismo: mesma entrada 2x produz mesma ordem", () => {
    const a = makeClassified({ id: "a", productCode: "F100", creditAmount: "150000.00" });
    const b = makeClassified({ id: "b", productCode: "F200", creditAmount: "250000.00" });
    const c = makeClassified({ id: "c", productCode: "F300", creditAmount: "250000.00" }, "attention");
    const run1 = rankConsortiumProducts([a, b, c], noPrefs, "regular");
    const run2 = rankConsortiumProducts([a, b, c], noPrefs, "regular");
    expect(run1.ranked.map((r) => r.product.id)).toEqual(run2.ranked.map((r) => r.product.id));
    expect(run1.ranked.map((r) => r.score)).toEqual(run2.ranked.map((r) => r.score));
  });
});

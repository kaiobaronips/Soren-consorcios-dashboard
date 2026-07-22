import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, ProductFilters } from "@/repositories/products";
import { listProducts } from "@/repositories/products";
import { runAtendimento } from "./atendimento";

vi.mock("@/repositories/products", () => ({
  listProducts: vi.fn(),
}));

vi.mock("@/repositories/settings", () => ({
  getOrgSettings: vi.fn(async () => ({
    eligibilityBasis: "regular",
    maxIncomeCommitmentPercent: "30",
    projectedRates: { igpm: "4.00", ipca: "4.00" },
  })),
}));

const products: Product[] = [
  {
    id: "vd48",
    productName: "Veículo VD100 – 48m",
    productCode: "VD100",
    administratorName: "Demo",
    category: "vehicle",
    creditAmount: "100000.00",
    termMonths: 48,
    totalAdministrationFeePercent: "18.000",
    first12InstallmentAmount: null,
    regularInstallmentAmount: "1200.00",
    correctionIndex: "IPCA",
    status: "active",
    isDemo: true,
    sourceDocumentId: null,
    sourcePage: null,
    extractionConfidence: null,
  },
  {
    id: "vd60",
    productName: "Veículo VD150 – 60m",
    productCode: "VD150",
    administratorName: "Demo",
    category: "vehicle",
    creditAmount: "150000.00",
    termMonths: 60,
    totalAdministrationFeePercent: "18.000",
    first12InstallmentAmount: null,
    regularInstallmentAmount: "1400.00",
    correctionIndex: "IPCA",
    status: "active",
    isDemo: true,
    sourceDocumentId: null,
    sourcePage: null,
    extractionConfidence: null,
  },
];

describe("runAtendimento", () => {
  beforeEach(() => {
    vi.mocked(listProducts).mockImplementation(async (filters: ProductFilters) => {
      return products.filter((product) => {
        if (filters.status && product.status !== filters.status) return false;
        if (filters.category && product.category !== filters.category) return false;
        if (filters.termMonths && product.termMonths !== filters.termMonths) return false;
        return true;
      });
    });
  });

  it("filtra os planos pelo prazo desejado antes da elegibilidade e ranking", async () => {
    const result = await runAtendimento({
      monthlyAvailableAmount: "2000.00",
      monthlyIncome: null,
      desiredCategory: "vehicle",
      desiredTermMonths: 48,
    });

    expect(listProducts).toHaveBeenCalledWith({
      status: "active",
      category: "vehicle",
      termMonths: 48,
    });
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].product.termMonths).toBe(48);
    expect(result.ranked[0].product.id).toBe("vd48");
  });
});

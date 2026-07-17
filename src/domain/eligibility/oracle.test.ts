import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { parseConsorcioXlsx, type ParsedProduct } from "@/lib/xlsx/parse-consorcio";
import { getEligibleProducts, type EligibilityProduct } from "./index";
import { summarizeEligibility } from "./summary";

const XLSX_PATH = path.resolve(__dirname, "../../../references/consorcio.xlsx");
let products: EligibilityProduct[] = [];

function toEligibility(p: ParsedProduct, i: number): EligibilityProduct {
  return {
    id: `x${i}`, productName: p.productName, productCode: p.productCode,
    administratorName: "Não informada (planilha)", category: "property",
    creditAmount: p.creditAmount, termMonths: p.termMonths,
    totalAdministrationFeePercent: p.totalAdministrationFeePercent,
    first12InstallmentAmount: p.first12InstallmentAmount,
    regularInstallmentAmount: p.regularInstallmentAmount,
    correctionIndex: "IGPM",
  };
}

beforeAll(async () => {
  const parsed = await parseConsorcioXlsx(XLSX_PATH);
  products = parsed.products.map(toEligibility);
});

// Oráculo: valores publicados na planilha (abas Clientes/Dashboard) — regra da planilha = basis "regular"
const ORACLE = [
  { name: "João Silva", available: "1500.00", maxCredit: "240000.00", count: 23 },
  { name: "Maria Souza", available: "3200.00", maxCredit: "580000.00", count: 56 },
  { name: "Carlos Pereira", available: "800.00", maxCredit: "140000.00", count: 6 },
  { name: "JANDIRINHA", available: "4550.00", maxCredit: "600000.00", count: 63 },
];

describe("oráculo da planilha (basis regular)", () => {
  for (const c of ORACLE) {
    it(`${c.name}: ${c.count} elegíveis, maior carta ${c.maxCredit}`, () => {
      const eligible = getEligibleProducts(products, c.available, "regular", null);
      const summary = summarizeEligibility(eligible, "regular", null);
      expect(summary.eligibleCount).toBe(c.count);
      expect(summary.maxPayableCredit).toBe(c.maxCredit);
    });
  }

  it("JANDIRINHA: menor parcela 644.00 e maior parcela compatível 3804.00 (aba Dashboard)", () => {
    const eligible = getEligibleProducts(products, "4550.00", "regular", null);
    const summary = summarizeEligibility(eligible, "regular", null);
    expect(summary.minInstallment).toBe("644.00");
    expect(summary.maxCompatibleInstallment).toBe("3804.00");
  });
});

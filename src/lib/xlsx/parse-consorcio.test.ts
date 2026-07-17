import { describe, expect, it } from "vitest";
import path from "node:path";
import { parseConsorcioXlsx } from "./parse-consorcio";

const XLSX_PATH = path.resolve(__dirname, "../../../references/consorcio.xlsx");

describe("parseConsorcioXlsx (oráculo: planilha real)", () => {
  it("extrai exatamente 63 produtos válidos, sem linhas inválidas", async () => {
    const { products, invalidRows } = await parseConsorcioXlsx(XLSX_PATH);
    expect(products).toHaveLength(63);
    expect(invalidRows).toHaveLength(0);
  });

  it("reproduz os valores exatos do IE600-240m e IE580-240m", async () => {
    const { products } = await parseConsorcioXlsx(XLSX_PATH);
    const ie600 = products.find((p) => p.productName === "Imóvel IE600 – 240m");
    expect(ie600).toMatchObject({
      productCode: "IE600",
      creditAmount: "600000.00",
      termMonths: 240,
      totalAdministrationFeePercent: "26.800",
      first12InstallmentAmount: "3820.00",
      regularInstallmentAmount: "3220.00",
    });
    const ie580 = products.find((p) => p.productName === "Imóvel IE580 – 240m");
    expect(ie580?.regularInstallmentAmount).toBe("3112.67");
  });

  it("taxa correlata ao prazo em todos os produtos", async () => {
    const { products } = await parseConsorcioXlsx(XLSX_PATH);
    const expected: Record<number, string> = { 200: "24.800", 220: "25.800", 240: "26.800" };
    for (const p of products) {
      expect(p.totalAdministrationFeePercent).toBe(expected[p.termMonths]);
    }
  });
});

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processBuffer } from "./pdf-pipeline";

const FIXTURES = path.resolve(process.cwd(), "tests/fixtures");
const loadFixture = async (name: string) => Buffer.from(await readFile(path.join(FIXTURES, name)));

describe("processBuffer (extração + parsing, sem I/O)", () => {
  it("extrai 3 produtos com confiança da fixture tabela-simples.pdf", async () => {
    const buffer = await loadFixture("tabela-simples.pdf");
    const { products, pageCount, log } = await processBuffer(buffer);

    expect(pageCount).toBe(1);
    expect(products).toHaveLength(3);
    expect(log.length).toBeGreaterThan(0);

    for (const product of products) {
      // §8.6: campos preenchidos têm confiança > 0.
      expect(product.overallConfidence).toBeGreaterThan(0);
      expect(product.productName.value).toBeTruthy();
      expect(product.productName.confidence).toBeGreaterThan(0);
      expect(product.creditAmount.value).not.toBeNull();
      expect(product.creditAmount.confidence).toBeGreaterThan(0);
      expect(product.termMonths.value).not.toBeNull();
      expect(product.regularInstallmentAmount.value).not.toBeNull();
    }

    const auto = products.find((p) => p.productName.value === "Auto Facil");
    expect(auto).toBeDefined();
    expect(auto!.creditAmount.value).toBe("50000.00");
    expect(auto!.termMonths.value).toBe(60);
    expect(auto!.totalAdministrationFeePercent.value).toBe("18.000");
    expect(auto!.regularInstallmentAmount.value).toBe("950.00");
  });
});

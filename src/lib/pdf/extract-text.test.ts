import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText, reconstructLines } from "./extract-text";
import { extractProductsFromText } from "./parse-products";

const FIXTURES = path.resolve(process.cwd(), "tests/fixtures");
const loadFixture = async (name: string) => Buffer.from(await readFile(path.join(FIXTURES, name)));

describe("reconstructLines", () => {
  it("insere 2 espaços entre colunas e preserva espaço interno da célula", () => {
    // Itens simulando pdfjs: transform = [fontSize,0,0,fontSize,x,y]; gap grande entre colunas.
    const items = [
      { str: "Auto Facil", transform: [10, 0, 0, 10, 40, 670], width: 44 },
      { str: "R$ 50.000,00", transform: [10, 0, 0, 10, 215, 670], width: 60 },
    ];
    const [line] = reconstructLines(items);
    expect(line).toBe("Auto Facil  R$ 50.000,00");
    // O parser da Task 1 divide por /\s{2,}|\t/ → duas células, sem quebrar "R$ 50.000,00".
    expect(line.split(/\s{2,}|\t+/)).toEqual(["Auto Facil", "R$ 50.000,00"]);
  });

  it("ordena linhas de cima para baixo pela coordenada y", () => {
    const items = [
      { str: "Rodape", transform: [10, 0, 0, 10, 40, 100], width: 30 },
      { str: "Topo", transform: [10, 0, 0, 10, 40, 700], width: 20 },
    ];
    expect(reconstructLines(items)).toEqual(["Topo", "Rodape"]);
  });
});

describe("extractPdfText — PDF nativo (tabela-simples.pdf)", () => {
  it("extrai por texto e reconstrói linhas colunadas", async () => {
    const buffer = await loadFixture("tabela-simples.pdf");
    const { pages, log } = await extractPdfText(buffer);

    expect(pages).toHaveLength(1);
    expect(pages[0].method).toBe("text");
    expect(log.some((entry) => entry.includes("texto nativo"))).toBe(true);

    // Cabeçalho e 3 linhas de produto presentes, cada um separado por ≥2 espaços.
    const joined = pages[0].lines.join("\n");
    expect(joined).toContain("Produto");
    expect(joined).toContain("Auto Facil");
    expect(joined).toContain("Imovel Plus");
    expect(joined).toContain("Moto Ja");

    const dataLine = pages[0].lines.find((l) => l.includes("Auto Facil"));
    expect(dataLine).toBeDefined();
    expect(dataLine!.split(/\s{2,}|\t+/).length).toBeGreaterThanOrEqual(6);
  });

  it("integração Task1+Task2: as linhas extraídas produzem 3 produtos com campos preenchidos", async () => {
    const buffer = await loadFixture("tabela-simples.pdf");
    const { pages } = await extractPdfText(buffer);

    const { products } = extractProductsFromText(
      pages.map(({ page, lines }) => ({ page, lines })),
    );

    expect(products).toHaveLength(3);
    for (const product of products) {
      expect(product.productName.value).toBeTruthy();
      expect(product.creditAmount.value).not.toBeNull();
      expect(product.termMonths.value).not.toBeNull();
      expect(product.totalAdministrationFeePercent.value).not.toBeNull();
      expect(product.regularInstallmentAmount.value).not.toBeNull();
    }

    // Valores concretos da primeira linha (Auto Facil).
    const auto = products.find((p) => p.productName.value === "Auto Facil");
    expect(auto).toBeDefined();
    expect(auto!.creditAmount.value).toBe("50000.00");
    expect(auto!.termMonths.value).toBe(60);
    expect(auto!.totalAdministrationFeePercent.value).toBe("18.000");
    expect(auto!.regularInstallmentAmount.value).toBe("950.00");
  });
});

describe("extractPdfText — PDF digitalizado (digitalizado.pdf)", () => {
  it(
    "aciona o caminho de OCR, registra em log e não inventa dados",
    async () => {
      const buffer = await loadFixture("digitalizado.pdf");
      const { pages, log } = await extractPdfText(buffer);

      expect(pages).toHaveLength(1);
      expect(pages[0].method).toBe("ocr");
      expect(log.some((entry) => entry.toLowerCase().includes("ocr"))).toBe(true);

      // Página só com retângulos: OCR não deve produzir produtos inventados.
      const { products } = extractProductsFromText(
        pages.map(({ page, lines }) => ({ page, lines })),
      );
      expect(products).toHaveLength(0);
    },
    60_000,
  );
});

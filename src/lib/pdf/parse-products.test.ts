import { describe, expect, it } from "vitest";
import { extractProductsFromText, type ColumnMapping, type PageText } from "./parse-products";

/** Monta uma página a partir de linhas de células (colunas separadas por 3 espaços). */
function page(pageNumber: number, rows: string[][]): PageText {
  return { page: pageNumber, lines: rows.map((cells) => cells.join("   ")) };
}

const STANDARD_HEADER = ["Produto", "Codigo", "Valor da Carta", "Prazo", "Taxa Adm Total", "Parcela 1a-12a", "Parcela Mensal"];

describe("extractProductsFromText", () => {
  it("(a) tabela padrão de 3 produtos: extrai 3 produtos com campos de confiança > 0", () => {
    const pages = [
      page(1, [
        STANDARD_HEADER,
        ["Imovel IE600", "IE600", "R$ 600.000,00", "240", "26,8%", "R$ 3.820,00", "R$ 3.220,00"],
        ["Imovel IE580", "IE580", "R$ 580.000,00", "240", "26,8%", "R$ 3.712,67", "R$ 3.112,67"],
        ["Imovel IE550", "IE550", "R$ 550.000,00", "220", "25,8%", "R$ 3.500,00", "R$ 2.900,00"],
      ]),
    ];
    const { products } = extractProductsFromText(pages);
    expect(products).toHaveLength(3);

    const ie600 = products[0];
    expect(ie600.creditAmount.value).toBe("600000.00");
    expect(ie600.termMonths.value).toBe(240);
    expect(ie600.totalAdministrationFeePercent.value).toBe("26.800");
    expect(ie600.first12InstallmentAmount.value).toBe("3820.00");
    expect(ie600.regularInstallmentAmount.value).toBe("3220.00");
    expect(ie600.productCode.value).toBe("IE600");
    expect(ie600.productName.value).toBe("Imovel IE600");

    for (const field of [
      ie600.productName,
      ie600.productCode,
      ie600.creditAmount,
      ie600.termMonths,
      ie600.totalAdministrationFeePercent,
      ie600.first12InstallmentAmount,
      ie600.regularInstallmentAmount,
    ]) {
      expect(field.confidence).toBeGreaterThan(0);
    }
    expect(ie600.overallConfidence).toBeGreaterThan(0);
    expect(ie600.issues).toHaveLength(0);
  });

  it("(b) caso 16 — coluna de Taxa ausente: value null, confidence 0 e issue legível", () => {
    const header = ["Produto", "Codigo", "Valor da Carta", "Prazo", "Parcela 1a-12a", "Parcela Mensal"];
    const pages = [
      page(2, [
        header,
        ["Imovel IE600", "IE600", "R$ 600.000,00", "240", "R$ 3.820,00", "R$ 3.220,00"],
      ]),
    ];
    const { products } = extractProductsFromText(pages);
    expect(products).toHaveLength(1);
    const p = products[0];
    expect(p.totalAdministrationFeePercent.value).toBeNull();
    expect(p.totalAdministrationFeePercent.confidence).toBe(0);
    expect(p.issues).toContain("coluna Taxa não identificada na página 2");
    // demais campos continuam válidos
    expect(p.creditAmount.value).toBe("600000.00");
    expect(p.regularInstallmentAmount.value).toBe("3220.00");
  });

  it("(c) colunas em outra ordem: ainda extrai via cabeçalho", () => {
    const header = ["Codigo", "Prazo", "Produto", "Parcela Mensal", "Valor da Carta", "Taxa Adm Total", "Parcela 1a-12a"];
    const pages = [
      page(1, [
        header,
        ["IE600", "240", "Imovel IE600", "R$ 3.220,00", "R$ 600.000,00", "26,8%", "R$ 3.820,00"],
      ]),
    ];
    const { products } = extractProductsFromText(pages);
    expect(products).toHaveLength(1);
    const p = products[0];
    expect(p.productCode.value).toBe("IE600");
    expect(p.termMonths.value).toBe(240);
    expect(p.productName.value).toBe("Imovel IE600");
    expect(p.creditAmount.value).toBe("600000.00");
    expect(p.totalAdministrationFeePercent.value).toBe("26.800");
    expect(p.regularInstallmentAmount.value).toBe("3220.00");
    expect(p.first12InstallmentAmount.value).toBe("3820.00");
  });

  it("extrai tabela ampla com prazo e taxa no contexto do documento", () => {
    const pages = [
      {
        page: 1,
        lines: [
          "Imóvel Tabela Parcelinha Antecipada",
          "Cód.  Crédito Referência  parcelas)  1ª a 12ª Parcela  Demais Parcelas",
          "IE600  600.000,00  7.200,00  3.820,00  3.220,00",
        ],
      },
      {
        page: 2,
        lines: [
          "Planos de Vendas",
          "240  26,80%  28,00%  220  25,80%  27,00%",
        ],
      },
    ];

    const { products } = extractProductsFromText(pages);
    expect(products).toHaveLength(1);
    expect(products[0].productName.value).toBe("Imóvel IE600 - 240m");
    expect(products[0].productCode.value).toBe("IE600");
    expect(products[0].creditAmount.value).toBe("600000.00");
    expect(products[0].termMonths.value).toBe(240);
    expect(products[0].totalAdministrationFeePercent.value).toBe("26.800");
    expect(products[0].first12InstallmentAmount.value).toBe("3820.00");
    expect(products[0].regularInstallmentAmount.value).toBe("3220.00");
    expect(products[0].issues).toHaveLength(0);
  });

  it("(d) manualMapping corrige uma inferência errada", () => {
    // Duas colunas casam com "valor" — a inferência pega a primeira (Valor Bem), que é errada.
    const header = ["Produto", "Codigo", "Valor Bem", "Valor da Carta", "Prazo", "Taxa Adm Total", "Parcela 1a-12a", "Parcela Mensal"];
    const pages = [
      page(1, [
        header,
        ["Imovel IE600", "IE600", "R$ 10.000,00", "R$ 600.000,00", "240", "26,8%", "R$ 3.820,00", "R$ 3.220,00"],
      ]),
    ];

    const semMapa = extractProductsFromText(pages).products[0];
    expect(semMapa.creditAmount.value).toBe("10000.00"); // inferência errada

    const mapa: ColumnMapping = { creditAmount: 3 };
    const comMapa = extractProductsFromText(pages, mapa).products[0];
    expect(comMapa.creditAmount.value).toBe("600000.00"); // corrigido
  });

  it("(e) página sem tabela: 0 produtos e log explicativo", () => {
    const pages = [
      page(3, [
        ["Este documento apresenta as condicoes gerais do consorcio."],
        ["Nenhuma tabela de produtos nesta pagina."],
      ]),
    ];
    const { products, log } = extractProductsFromText(pages);
    expect(products).toHaveLength(0);
    expect(log.some((l) => l.includes("página 3") && l.toLowerCase().includes("nenhuma tabela"))).toBe(true);
  });

  it("validações §8.9: parcela >= carta zera a confiança do campo e vira issue", () => {
    const pages = [
      page(1, [
        STANDARD_HEADER,
        // Parcela Mensal (700.000) > Valor da Carta (600.000) → inválida
        ["Imovel X", "IX", "R$ 600.000,00", "240", "26,8%", "R$ 3.820,00", "R$ 700.000,00"],
      ]),
    ];
    const p = extractProductsFromText(pages).products[0];
    expect(p.regularInstallmentAmount.value).toBeNull();
    expect(p.regularInstallmentAmount.confidence).toBe(0);
    expect(p.issues.some((i) => i.toLowerCase().includes("parcela mensal"))).toBe(true);
  });

  it("validações §8.9: prazo fora de 1–600 zera a confiança do campo", () => {
    const pages = [
      page(1, [
        STANDARD_HEADER,
        ["Imovel X", "IX", "R$ 600.000,00", "999", "26,8%", "R$ 3.820,00", "R$ 3.220,00"],
      ]),
    ];
    const p = extractProductsFromText(pages).products[0];
    expect(p.termMonths.value).toBeNull();
    expect(p.termMonths.confidence).toBe(0);
    expect(p.issues.some((i) => i.toLowerCase().includes("prazo"))).toBe(true);
  });
});

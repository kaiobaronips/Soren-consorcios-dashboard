import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatPercent } from "./format";

describe("formatCurrency", () => {
  it("formata BRL pt-BR", () => {
    expect(formatCurrency(3220)).toBe("R$ 3.220,00");
    expect(formatCurrency("3112.67")).toBe("R$ 3.112,67");
  });
});

describe("formatPercent", () => {
  it("formata pontos percentuais com 2 casas quando necessário", () => {
    expect(formatPercent(26.8)).toBe("26,80%");
  });
});

describe("formatDate", () => {
  it("formata dd/MM/yyyy no fuso America/Sao_Paulo", () => {
    expect(formatDate(new Date("2026-07-16T03:00:00Z"))).toBe("16/07/2026");
  });
});

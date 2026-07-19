import { describe, expect, it } from "vitest";
import { parseBrlMoney, parseBrlPercent, parseIntSafe } from "./parse-values";

describe("parseBrlMoney", () => {
  it("normaliza valores pt-BR com R$, separador de milhar e centavos", () => {
    expect(parseBrlMoney("R$ 600.000,00")).toBe("600000.00");
    expect(parseBrlMoney("600.000,00")).toBe("600000.00");
    expect(parseBrlMoney("R$ 3.820,00")).toBe("3820.00");
    expect(parseBrlMoney("3.112,67")).toBe("3112.67");
  });

  it("aceita números sem separador de milhar e sem centavos", () => {
    expect(parseBrlMoney("3220,00")).toBe("3220.00");
    expect(parseBrlMoney("3220")).toBe("3220.00");
  });

  it("retorna null para valores inválidos", () => {
    expect(parseBrlMoney("")).toBeNull();
    expect(parseBrlMoney("   ")).toBeNull();
    expect(parseBrlMoney("abc")).toBeNull();
    expect(parseBrlMoney("R$ -")).toBeNull();
    expect(parseBrlMoney("1,2,3")).toBeNull();
  });
});

describe("parseBrlPercent", () => {
  it("normaliza percentuais pt-BR para 3 casas (NUMERIC(6,3))", () => {
    expect(parseBrlPercent("26,8%")).toBe("26.800");
    expect(parseBrlPercent("26,8")).toBe("26.800");
    expect(parseBrlPercent("24,80 %")).toBe("24.800");
    expect(parseBrlPercent("2")).toBe("2.000");
  });

  it("retorna null para percentuais inválidos", () => {
    expect(parseBrlPercent("")).toBeNull();
    expect(parseBrlPercent("--")).toBeNull();
    expect(parseBrlPercent("taxa")).toBeNull();
  });
});

describe("parseIntSafe", () => {
  it("extrai inteiro do começo da string", () => {
    expect(parseIntSafe("240")).toBe(240);
    expect(parseIntSafe("240x")).toBe(240);
    expect(parseIntSafe(" 220 meses")).toBe(220);
  });

  it("retorna null quando não há inteiro no começo", () => {
    expect(parseIntSafe("")).toBeNull();
    expect(parseIntSafe("meses")).toBeNull();
    expect(parseIntSafe("x240")).toBeNull();
  });
});

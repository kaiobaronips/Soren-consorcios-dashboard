import { describe, expect, it } from "vitest";
import { fractionToPercentPoints, toMoneyString } from "./normalize";

describe("fractionToPercentPoints", () => {
  it("converte fração da planilha para pontos percentuais com 3 casas", () => {
    expect(fractionToPercentPoints(0.268)).toBe("26.800");
    expect(fractionToPercentPoints(0.248)).toBe("24.800");
    expect(fractionToPercentPoints(0.02)).toBe("2.000");
  });
});

describe("toMoneyString", () => {
  it("arredonda a 2 casas half-up sem erro de float", () => {
    expect(toMoneyString(3112.666666)).toBe("3112.67");
    expect(toMoneyString(3220)).toBe("3220.00");
    expect(toMoneyString(1985.4499999999998)).toBe("1985.45");
  });
});

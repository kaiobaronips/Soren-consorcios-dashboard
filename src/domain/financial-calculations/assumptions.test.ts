import { describe, expect, it } from "vitest";
import { resolveScenarioRate } from "./assumptions";

describe("resolveScenarioRate", () => {
  it("conservador = base × 0.7 (4 casas)", () => {
    expect(resolveScenarioRate("6.5", "conservative")).toBe("4.5500");
  });

  it("base = base (4 casas)", () => {
    expect(resolveScenarioRate("6.5", "base")).toBe("6.5000");
  });

  it("agressivo = base × 1.3 (4 casas)", () => {
    expect(resolveScenarioRate("6.5", "aggressive")).toBe("8.4500");
  });

  it("custom = valor informado (4 casas)", () => {
    expect(resolveScenarioRate("6.5", "custom", "10")).toBe("10.0000");
  });

  it("custom sem valor informado lança erro", () => {
    expect(() => resolveScenarioRate("6.5", "custom")).toThrow();
  });
});

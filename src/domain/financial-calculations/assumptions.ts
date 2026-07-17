import Decimal from "decimal.js";

export type Scenario = "conservative" | "base" | "aggressive" | "custom";

/** Taxas anuais projetadas por índice, em pontos percentuais (ex.: "6.5"). */
export type ProjectedRates = { igpm: string; ipca: string; cdi: string; savings: string };

export type SimulationAssumptions = {
  scenario: Scenario;
  indexCode: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
  annualRatePercent: string;
  rateOrigin: string;
  rateUpdatedAt: string;
  rateType: "projected" | "historical" | "manual";
  adjustmentFrequencyMonths: number;
};

/** Fatores multiplicativos por cenário sobre a taxa base do índice. */
const SCENARIO_FACTOR: Record<Exclude<Scenario, "custom">, string> = {
  conservative: "0.7",
  base: "1",
  aggressive: "1.3",
};

/**
 * Deriva a taxa do cenário a partir da taxa base do índice.
 * conservador = base × 0.7; base = base; agressivo = base × 1.3; custom = valor informado.
 * A validação de quem pode usar "custom" (papel autorizado) fica na action, não aqui.
 * Todos os resultados com 4 casas decimais.
 */
export function resolveScenarioRate(baseRatePercent: string, scenario: Scenario, customRatePercent?: string): string {
  if (scenario === "custom") {
    if (customRatePercent === undefined) {
      throw new Error("customRatePercent é obrigatório para o cenário custom");
    }
    return new Decimal(customRatePercent).toFixed(4);
  }
  return new Decimal(baseRatePercent).times(SCENARIO_FACTOR[scenario]).toFixed(4);
}

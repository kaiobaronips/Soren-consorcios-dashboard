import Decimal from "decimal.js";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EligibilityBasis } from "@/domain/eligibility";
import type { ProjectedRates } from "@/domain/financial-calculations";

export type OrgSettings = {
  eligibilityBasis: EligibilityBasis;
  maxIncomeCommitmentPercent: number;
  projectedAnnualRates: ProjectedRates;
};

const DEFAULT_PROJECTED_RATES: ProjectedRates = {
  igpm: "6.5000", ipca: "4.5000", cdi: "10.5000", savings: "6.2000",
};

const DEFAULT_SETTINGS: OrgSettings = {
  eligibilityBasis: "regular",
  maxIncomeCommitmentPercent: 30,
  projectedAnnualRates: DEFAULT_PROJECTED_RATES,
};

const VALID_BASIS = new Set<EligibilityBasis>(["regular", "first", "max"]);

/** Parse defensivo: `value` vem de JSONB e pode estar malformado (chave ausente, tipo errado etc). */
function parseEligibilityBasis(value: unknown): EligibilityBasis {
  if (value && typeof value === "object" && "basis" in (value as Record<string, unknown>)) {
    const basis = (value as { basis?: unknown }).basis;
    if (typeof basis === "string" && VALID_BASIS.has(basis as EligibilityBasis)) {
      return basis as EligibilityBasis;
    }
  }
  return DEFAULT_SETTINGS.eligibilityBasis;
}

function parseMaxIncomeCommitmentPercent(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SETTINGS.maxIncomeCommitmentPercent;
}

/** Normaliza um campo de taxa de `projected_annual_rates` para pontos %, 4 casas. Inválido cai no default. */
function parseRateField(value: unknown, fallback: string): string {
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() ? decimal.toFixed(4) : fallback;
  } catch {
    return fallback;
  }
}

/** Parse defensivo: `value` vem de JSONB e pode estar malformado (chaves ausentes, tipos errados etc). */
function parseProjectedAnnualRates(value: unknown): ProjectedRates {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    igpm: parseRateField(obj.IGPM, DEFAULT_PROJECTED_RATES.igpm),
    ipca: parseRateField(obj.IPCA, DEFAULT_PROJECTED_RATES.ipca),
    cdi: parseRateField(obj.CDI, DEFAULT_PROJECTED_RATES.cdi),
    savings: parseRateField(obj.SAVINGS, DEFAULT_PROJECTED_RATES.savings),
  };
}

type Row = { key: string; value: unknown };

/** Lê configurações da organização (RLS filtra por org). Chaves ausentes/malformadas caem no default. */
export async function getOrgSettings(): Promise<OrgSettings> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["eligibility_rule", "max_income_commitment_percent", "projected_annual_rates"]);
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const eligibilityRule = rows.find((r) => r.key === "eligibility_rule")?.value;
  const maxIncomeCommitmentPercent = rows.find((r) => r.key === "max_income_commitment_percent")?.value;
  const projectedAnnualRates = rows.find((r) => r.key === "projected_annual_rates")?.value;

  return {
    eligibilityBasis: parseEligibilityBasis(eligibilityRule),
    maxIncomeCommitmentPercent: parseMaxIncomeCommitmentPercent(maxIncomeCommitmentPercent),
    projectedAnnualRates: parseProjectedAnnualRates(projectedAnnualRates),
  };
}

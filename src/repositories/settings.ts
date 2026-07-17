import { createServerSupabase } from "@/lib/supabase/server";
import type { EligibilityBasis } from "@/domain/eligibility";

export type OrgSettings = {
  eligibilityBasis: EligibilityBasis;
  maxIncomeCommitmentPercent: number;
};

const DEFAULT_SETTINGS: OrgSettings = {
  eligibilityBasis: "regular",
  maxIncomeCommitmentPercent: 30,
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

type Row = { key: string; value: unknown };

/** Lê configurações da organização (RLS filtra por org). Chaves ausentes/malformadas caem no default. */
export async function getOrgSettings(): Promise<OrgSettings> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["eligibility_rule", "max_income_commitment_percent"]);
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const eligibilityRule = rows.find((r) => r.key === "eligibility_rule")?.value;
  const maxIncomeCommitmentPercent = rows.find((r) => r.key === "max_income_commitment_percent")?.value;

  return {
    eligibilityBasis: parseEligibilityBasis(eligibilityRule),
    maxIncomeCommitmentPercent: parseMaxIncomeCommitmentPercent(maxIncomeCommitmentPercent),
  };
}

import Decimal from "decimal.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export type FinancialIndex = {
  indexCode: string;
  annualRatePercent: string;
  source: string;
  updatedAt: string;
  projected: boolean;
};

/**
 * PostgREST devolve NUMERIC como number no JSON (perde zeros à direita);
 * normalizamos annual_rate para string canônica com decimal.js antes de expor.
 */
type Row = {
  index_code: string;
  annual_rate: number | null;
  reference_period: string;
  source: string;
  projected: boolean;
  updated_at: string;
};

function toFinancialIndex(r: Row): FinancialIndex {
  return {
    indexCode: r.index_code,
    annualRatePercent: new Decimal(r.annual_rate ?? 0).toFixed(4),
    source: r.source,
    updatedAt: r.updated_at,
    projected: r.projected,
  };
}

/**
 * Lê `financial_indexes` (RLS filtra por org / registros globais) e retorna,
 * por `index_code`, o registro mais recente (maior `reference_period`).
 */
export async function getLatestIndexes(): Promise<Record<string, FinancialIndex>> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("financial_indexes")
    .select("index_code, annual_rate, reference_period, source, projected, updated_at")
    .order("reference_period", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const latest: Record<string, FinancialIndex> = {};
  for (const row of rows) {
    // rows já vêm ordenadas por reference_period desc: a primeira ocorrência de cada
    // index_code é a mais recente.
    if (!(row.index_code in latest)) {
      latest[row.index_code] = toFinancialIndex(row);
    }
  }
  return latest;
}

/**
 * Grava (insere/atualiza) um valor de índice em `financial_indexes` — usado pela
 * sincronização com fontes oficiais. Recebe um client já autenticado (service role no
 * job de sync), pois roda fora de uma requisição de usuário. Dedup por
 * (index_code, reference_period, organization_id) — aqui sempre global (organization_id nulo).
 */
export async function upsertGlobalIndex(
  supabase: SupabaseClient,
  params: {
    indexCode: string;
    referencePeriod: string;
    annualRatePercent: string;
    monthlyRatePercent?: string | null;
    source: string;
    sourceUrl?: string | null;
    projected: boolean;
  },
): Promise<void> {
  const payload = {
    index_code: params.indexCode,
    reference_period: params.referencePeriod,
    annual_rate: params.annualRatePercent,
    monthly_rate: params.monthlyRatePercent ?? null,
    source: params.source,
    source_url: params.sourceUrl ?? null,
    projected: params.projected,
    updated_at: new Date().toISOString(),
  };
  // O índice único usa coalesce(organization_id, ...), incompatível com onConflict do
  // PostgREST — buscamos o registro global equivalente e atualizamos, senão inserimos.
  const { data: existing, error: selErr } = await supabase
    .from("financial_indexes")
    .select("id")
    .is("organization_id", null)
    .eq("index_code", params.indexCode)
    .eq("reference_period", params.referencePeriod)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const { error } = await supabase.from("financial_indexes").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("financial_indexes").insert({ organization_id: null, ...payload });
    if (error) throw error;
  }
}

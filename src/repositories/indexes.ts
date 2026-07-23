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
export type FinancialIndexRow = {
  index_code: string;
  annual_rate: number | null;
  reference_period: string;
  source: string;
  projected: boolean;
  updated_at: string;
};

function toFinancialIndex(r: FinancialIndexRow): FinancialIndex {
  return {
    indexCode: r.index_code,
    annualRatePercent: new Decimal(r.annual_rate ?? 0).toFixed(4),
    source: r.source,
    updatedAt: r.updated_at,
    projected: r.projected,
  };
}

/**
 * Escolhe um valor por índice priorizando dados oficiais/históricos sobre projeções.
 * Entre registros do mesmo tipo, vence o atualizado mais recentemente.
 *
 * Isso impede que um seed projetado e mais novo esconda uma taxa sincronizada do BCB.
 */
export function selectPreferredIndexes(rows: FinancialIndexRow[]): Record<string, FinancialIndex> {
  const preferred: Record<string, FinancialIndexRow> = {};

  for (const row of rows) {
    const current = preferred[row.index_code];
    if (
      !current
      || (current.projected && !row.projected)
      || (current.projected === row.projected && row.updated_at > current.updated_at)
    ) {
      preferred[row.index_code] = row;
    }
  }

  return Object.fromEntries(
    Object.entries(preferred).map(([indexCode, row]) => [indexCode, toFinancialIndex(row)]),
  );
}

/**
 * Lê `financial_indexes` (RLS filtra por org / registros globais) e retorna,
 * por `index_code`, o dado oficial quando disponível; projeções são fallback.
 */
export async function getLatestIndexes(): Promise<Record<string, FinancialIndex>> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("financial_indexes")
    .select("index_code, annual_rate, reference_period, source, projected, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return selectPreferredIndexes((data ?? []) as FinancialIndexRow[]);
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

import Decimal from "decimal.js";
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

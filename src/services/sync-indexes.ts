import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSgsSeries, sgsDateToReferencePeriod } from "@/lib/bcb/client";
import { accumulateMonthlyToAnnual, annualizeDailyRate } from "@/lib/bcb/normalize";
import { upsertGlobalIndex } from "@/repositories/indexes";

/**
 * Códigos de série do SGS (Banco Central) por índice. AJUSTÁVEL: valide contra a API real
 * (https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados/ultimos/1?formato=json) e
 * corrija aqui se algum código não corresponder ao esperado.
 *  - monthly_accumulate12: série vem mês a mês (%); anualizamos acumulando 12 meses.
 *  - daily_annualize252: série vem ao dia (%); anualizamos por (1+d)^252.
 */
export const SGS_SERIES: Record<string, { code: number; kind: "monthly_accumulate12" | "daily_annualize252" }> = {
  IGPM: { code: 189, kind: "monthly_accumulate12" },
  IPCA: { code: 433, kind: "monthly_accumulate12" },
  CDI: { code: 12, kind: "daily_annualize252" },
  SAVINGS: { code: 195, kind: "monthly_accumulate12" },
};

const SOURCE = "Banco Central (SGS)";
const SOURCE_URL = "https://www3.bcb.gov.br/sgspub/";

export type SyncResult = { updated: string[]; failed: { indexCode: string; reason: string }[] };

/**
 * Sincroniza os índices a partir do SGS e grava em `financial_indexes` (source oficial,
 * projected=false). Cada índice é independente: falha/timeout de um NÃO derruba os demais
 * nem a aplicação — o último valor bom permanece no banco (fallback). Retorna um relatório.
 */
export async function syncIndexesFromBcb(supabase: SupabaseClient): Promise<SyncResult> {
  const result: SyncResult = { updated: [], failed: [] };

  for (const [indexCode, cfg] of Object.entries(SGS_SERIES)) {
    try {
      if (cfg.kind === "monthly_accumulate12") {
        const points = await fetchSgsSeries(cfg.code, 12);
        if (points.length === 0) throw new Error("série vazia");
        const annual = accumulateMonthlyToAnnual(points.map((p) => String(p.valor)));
        const last = points[points.length - 1];
        await upsertGlobalIndex(supabase, {
          indexCode,
          referencePeriod: sgsDateToReferencePeriod(last.data),
          annualRatePercent: annual,
          monthlyRatePercent: String(last.valor),
          source: SOURCE,
          sourceUrl: SOURCE_URL,
          projected: false,
        });
      } else {
        const points = await fetchSgsSeries(cfg.code, 1);
        if (points.length === 0) throw new Error("série vazia");
        const last = points[points.length - 1];
        await upsertGlobalIndex(supabase, {
          indexCode,
          referencePeriod: sgsDateToReferencePeriod(last.data),
          annualRatePercent: annualizeDailyRate(String(last.valor)),
          monthlyRatePercent: null,
          source: SOURCE,
          sourceUrl: SOURCE_URL,
          projected: false,
        });
      }
      result.updated.push(indexCode);
    } catch (e) {
      // "fetch failed" do undici esconde o erro real em `cause` (ENOTFOUND, ECONNREFUSED,
      // erro de TLS...). Expor a causa é o que diz por que a conexão falhou.
      let reason = e instanceof Error ? e.message : String(e);
      const cause = (e as { cause?: unknown })?.cause;
      if (cause) {
        const causeMsg = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
        const code = (cause as { code?: string })?.code;
        reason += ` (causa: ${code ? code + " — " : ""}${causeMsg})`;
      }
      result.failed.push({ indexCode, reason });
    }
  }

  return result;
}

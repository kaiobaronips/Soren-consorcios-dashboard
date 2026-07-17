import { formatDate, formatPercent } from "@/lib/format";
import type { SimulationAssumptions } from "@/domain/financial-calculations";

const RATE_TYPE_LABEL: Record<SimulationAssumptions["rateType"], string> = {
  projected: "Projetada",
  historical: "Histórica",
  manual: "Manual",
};

const INDEX_LABEL: Record<SimulationAssumptions["indexCode"], string> = {
  IGPM: "IGP-M",
  IPCA: "IPCA",
  INCC: "INCC",
  NONE: "Sem correção",
  CUSTOM: "Personalizado",
};

/**
 * Exibe as premissas correntes da simulação (índice, taxa, origem, data, frequência, tipo).
 * Puramente apresentacional — recebe os valores já resolvidos (nenhum cálculo aqui).
 */
export function AssumptionsBlock({ assumptions }: { assumptions: SimulationAssumptions }) {
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Índice</dt>
        <dd>{INDEX_LABEL[assumptions.indexCode]}</dd>
        <dt className="text-muted-foreground">Taxa anual</dt>
        <dd>{formatPercent(assumptions.annualRatePercent)}</dd>
        <dt className="text-muted-foreground">Origem</dt>
        <dd>{assumptions.rateOrigin}</dd>
        <dt className="text-muted-foreground">Atualizado em</dt>
        <dd>{formatDate(assumptions.rateUpdatedAt)}</dd>
        <dt className="text-muted-foreground">Frequência de reajuste</dt>
        <dd>{assumptions.adjustmentFrequencyMonths} meses</dd>
        <dt className="text-muted-foreground">Tipo</dt>
        <dd>{RATE_TYPE_LABEL[assumptions.rateType]}</dd>
      </dl>
      <p className="rounded-md border border-yellow-600/30 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-700 dark:text-yellow-400">
        Estimativa — não é garantia de resultado.
      </p>
    </div>
  );
}

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
    <div className="enterprise-simulation-assumptions">
      <dl>
        <dt>Índice</dt>
        <dd>{INDEX_LABEL[assumptions.indexCode]}</dd>
        <dt>Taxa anual</dt>
        <dd>{formatPercent(assumptions.annualRatePercent)}</dd>
        <dt>Origem</dt>
        <dd>{assumptions.rateOrigin}</dd>
        <dt>Atualizado em</dt>
        <dd>{formatDate(assumptions.rateUpdatedAt)}</dd>
        <dt>Frequência de reajuste</dt>
        <dd>{assumptions.adjustmentFrequencyMonths} meses</dd>
        <dt>Tipo</dt>
        <dd>{RATE_TYPE_LABEL[assumptions.rateType]}</dd>
      </dl>
      <p className="enterprise-simulation-notice">
        Estimativa — não é garantia de resultado.
      </p>
    </div>
  );
}

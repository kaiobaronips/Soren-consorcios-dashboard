import { notFound } from "next/navigation";
import { getSimulation, type SimulationSnapshotInput } from "@/repositories/simulations";
import { getClient } from "@/repositories/clients";
import { listProfileNames } from "@/repositories/profiles";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import type { SimulationAssumptions } from "@/domain/financial-calculations";
import { PrintButton } from "@/features/simulations/print-button";

const SCENARIO_LABEL: Record<SimulationAssumptions["scenario"], string> = {
  conservative: "Conservador",
  base: "Base",
  aggressive: "Agressivo",
  custom: "Personalizado",
};

const RATE_TYPE_LABEL: Record<SimulationAssumptions["rateType"], string> = {
  projected: "Taxa projetada",
  historical: "Taxa histórica",
  manual: "Definida manualmente",
};

/**
 * Resumo imprimível da simulação (prompt §23). Todos os dados de produto e premissas vêm
 * do snapshot gravado na simulação — nunca do produto/índice atuais, que podem ter mudado
 * desde que a simulação foi salva.
 */
export default async function SimulationSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const simulation = await getSimulation(id);
  if (!simulation) notFound();

  const [client, consultantNames] = await Promise.all([
    getClient(simulation.clientId),
    listProfileNames(),
  ]);
  if (!client) notFound();

  const product = simulation.productSnapshot as SimulationSnapshotInput["product"] | null;
  const assumptions = simulation.assumptionsSnapshot as SimulationAssumptions | null;
  const consultantName = consultantNames[simulation.consultantId] ?? "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6 print:max-w-none">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Resumo da simulação</h1>
          <p className="text-muted-foreground">Soren Consórcios</p>
        </div>
        <PrintButton />
      </div>

      <section className="space-y-1 rounded-md border p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Cliente:</span> {client.name}
        </p>
        <p>
          <span className="text-muted-foreground">Consultor:</span> {consultantName}
        </p>
        <p>
          <span className="text-muted-foreground">Data da simulação:</span> {formatDate(simulation.createdAt)}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Produto simulado</h2>
        {product ? (
          <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm">
            <Info label="Produto" value={product.productName} />
            <Info label="Carta nominal" value={formatCurrency(product.creditAmount)} />
            <Info label="Prazo" value={`${product.termMonths} meses`} />
            <Info label="Parcela regular" value={formatCurrency(product.regularInstallmentAmount)} />
            {product.first12InstallmentAmount && (
              <Info label="Parcela (12 primeiros meses)" value={formatCurrency(product.first12InstallmentAmount)} />
            )}
            <Info label="Taxa de administração total" value={formatPercent(product.totalAdministrationFeePercent)} />
            <Info label="Índice de correção" value={product.correctionIndex} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Dados do produto não disponíveis nesta simulação.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Projeção selecionada</h2>
        <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm">
          <Info label="Ano selecionado" value={simulation.selectedYear !== null ? `Ano ${simulation.selectedYear}` : "—"} />
          <Info label="Carta base" value={formatCurrency(simulation.baseCreditAmount)} />
          <Info
            label="Carta projetada"
            value={simulation.projectedCreditAmount ? formatCurrency(simulation.projectedCreditAmount) : "—"}
          />
          <Info label="Parcela base" value={formatCurrency(simulation.baseInstallmentAmount)} />
          <Info
            label="Parcela projetada"
            value={simulation.projectedInstallmentAmount ? formatCurrency(simulation.projectedInstallmentAmount) : "—"}
          />
          <Info
            label="Total pago até o mês"
            value={simulation.projectedTotalPaid ? formatCurrency(simulation.projectedTotalPaid) : "—"}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Premissas usadas</h2>
        {assumptions ? (
          <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm">
            <Info label="Cenário" value={SCENARIO_LABEL[assumptions.scenario] ?? assumptions.scenario} />
            <Info label="Índice" value={assumptions.indexCode} />
            <Info label="Taxa anual" value={formatPercent(assumptions.annualRatePercent)} />
            <Info label="Origem da taxa" value={assumptions.rateOrigin} />
            <Info label="Tipo da taxa" value={RATE_TYPE_LABEL[assumptions.rateType] ?? assumptions.rateType} />
            <Info label="Taxa atualizada em" value={formatDate(assumptions.rateUpdatedAt)} />
            <Info label="Frequência de reajuste" value={`${assumptions.adjustmentFrequencyMonths} meses`} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Premissas não disponíveis nesta simulação.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Comparação com CDI</h2>
        <div className="rounded-md border p-4 text-sm">
          {simulation.cdiComparisonValue ? (
            <Info label="Valor comparado ao CDI" value={formatCurrency(simulation.cdiComparisonValue)} />
          ) : (
            <p className="text-muted-foreground">
              Comparação com CDI não foi registrada nesta simulação.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-1 rounded-md border border-dashed p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Avisos legais</p>
        <p>
          Os valores apresentados são estimativas calculadas com base em premissas de correção e cenários
          projetados no momento da simulação, podendo variar conforme o índice de correção efetivamente
          aplicado ao longo do prazo do contrato. Este documento não constitui proposta comercial, contrato
          ou garantia de rentabilidade e não substitui as condições estabelecidas no contrato de adesão ao
          grupo de consórcio.
        </p>
      </section>

      <section className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Soren Consórcios</p>
        <p>Consultor responsável: {consultantName}</p>
        <p>Este resumo foi gerado automaticamente e reflete os dados vigentes na data da simulação.</p>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

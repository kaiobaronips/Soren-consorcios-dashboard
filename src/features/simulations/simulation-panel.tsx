"use client";

import { useActionState, useMemo, useState } from "react";
import Decimal from "decimal.js";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  chartAxisTick,
  chartGridStroke,
  chartLineAnimation,
  chartSeries,
  chartTooltipContentStyle,
  chartTooltipLabelStyle,
} from "@/components/ui/chart-theme";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { FinancialIndex } from "@/repositories/indexes";
import {
  annualCorrectionFactor,
  buildYearlySeries,
  calculateCorrectedCredit,
  calculateTotalProjectedPayments,
  contractYearOfMonth,
  correctedInstallmentForMonth,
  resolveScenarioRate,
  type ProjectedRates,
  type Scenario,
  type SimulationAssumptions,
} from "@/domain/financial-calculations";
import { AssumptionsBlock } from "./assumptions-block";
import { CdiCompoundSlider } from "./cdi-compound-slider";
import { CorrectionSlider } from "./correction-slider";
import { InvestmentComparison } from "./investment-comparison";
import { saveSimulationAction } from "./actions";

export type SimulationPanelProduct = {
  id: string;
  productName: string;
  creditAmount: string;
  termMonths: number;
  regularInstallmentAmount: string;
  first12InstallmentAmount: string | null;
  totalAdministrationFeePercent: string;
  correctionIndex: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
};

const SCENARIO_OPTIONS: { value: Scenario; label: string }[] = [
  { value: "conservative", label: "Conservador" },
  { value: "base", label: "Base" },
  { value: "aggressive", label: "Agressivo" },
  { value: "custom", label: "Personalizado" },
];

/**
 * Resolve as premissas BASE (antes do cenário) para o produto a partir dos dados vindos
 * do servidor: índice ao vivo (`indexes`, mais recente por `index_code`) ou, na ausência
 * dele, a taxa projetada da organização (`projectedRates`). Seleção de dados apenas — nenhum
 * cálculo financeiro (o cenário é aplicado depois via `resolveScenarioRate`, no domínio).
 */
function resolveBaseAssumptions(
  product: SimulationPanelProduct,
  indexes: Record<string, FinancialIndex>,
  projectedRates: ProjectedRates,
): Omit<SimulationAssumptions, "scenario" | "annualRatePercent"> & { baseRatePercent: string } {
  const live = indexes[product.correctionIndex];
  if (live) {
    return {
      indexCode: product.correctionIndex,
      baseRatePercent: live.annualRatePercent,
      rateOrigin: live.source,
      rateUpdatedAt: live.updatedAt,
      rateType: live.projected ? "projected" : "historical",
      adjustmentFrequencyMonths: 12,
    };
  }

  const PROJECTED_BY_INDEX: Partial<Record<SimulationPanelProduct["correctionIndex"], string>> = {
    IGPM: projectedRates.igpm,
    IPCA: projectedRates.ipca,
  };
  const projected = PROJECTED_BY_INDEX[product.correctionIndex];
  if (projected) {
    return {
      indexCode: product.correctionIndex,
      baseRatePercent: projected,
      rateOrigin: "Taxa projetada da organização",
      rateUpdatedAt: new Date().toISOString(),
      rateType: "projected",
      adjustmentFrequencyMonths: 12,
    };
  }

  return {
    indexCode: product.correctionIndex,
    baseRatePercent: "0",
    rateOrigin: product.correctionIndex === "NONE" ? "Sem índice de correção" : "Definida manualmente pelo consultor",
    rateUpdatedAt: new Date().toISOString(),
    rateType: "manual",
    adjustmentFrequencyMonths: 12,
  };
}

export function SimulationPanel({
  product,
  clientId,
  monthlyAvailableAmount,
  monthlyIncome,
  indexes,
  projectedRates,
  canEditRate,
}: {
  product: SimulationPanelProduct;
  clientId: string;
  monthlyAvailableAmount: string;
  monthlyIncome: string | null;
  indexes: Record<string, FinancialIndex>;
  projectedRates: ProjectedRates;
  canEditRate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(product.termMonths);
  const [scenario, setScenario] = useState<Scenario>("base");
  const [customRate, setCustomRate] = useState("");
  const [saveState, saveAction, savePending] = useActionState(saveSimulationAction, undefined);

  const base = useMemo(
    () => resolveBaseAssumptions(product, indexes, projectedRates),
    [product, indexes, projectedRates],
  );

  const effectiveScenario: Scenario = scenario === "custom" && !canEditRate ? "base" : scenario;

  const annualRatePercent = useMemo(() => {
    if (effectiveScenario === "custom") {
      if (customRate.trim() === "") return base.baseRatePercent;
      try {
        return resolveScenarioRate(base.baseRatePercent, "custom", customRate);
      } catch {
        return base.baseRatePercent;
      }
    }
    return resolveScenarioRate(base.baseRatePercent, effectiveScenario);
  }, [base.baseRatePercent, effectiveScenario, customRate]);

  const assumptions: SimulationAssumptions = {
    scenario: effectiveScenario,
    indexCode: effectiveScenario === "custom" ? "CUSTOM" : base.indexCode,
    annualRatePercent,
    rateOrigin: effectiveScenario === "custom" ? "Definida manualmente pelo consultor" : base.rateOrigin,
    rateUpdatedAt: base.rateUpdatedAt,
    rateType: effectiveScenario === "custom" ? "manual" : base.rateType,
    adjustmentFrequencyMonths: base.adjustmentFrequencyMonths,
  };

  const effectiveMonth = Math.max(month, 1);
  const selectedYear = contractYearOfMonth(effectiveMonth);

  const projectedCredit = calculateCorrectedCredit(product.creditAmount, annualRatePercent, selectedYear);
  const projectedInstallment = correctedInstallmentForMonth(
    product.regularInstallmentAmount,
    annualRatePercent,
    effectiveMonth,
  );
  const projectedTotalPaid = calculateTotalProjectedPayments(
    product.regularInstallmentAmount,
    annualRatePercent,
    effectiveMonth,
  );
  const accumulatedCorrectionPercent = new Decimal(annualCorrectionFactor(annualRatePercent, selectedYear))
    .minus(1)
    .times(100)
    .toFixed(2);

  const series = useMemo(
    () =>
      buildYearlySeries(
        product.regularInstallmentAmount,
        product.creditAmount,
        annualRatePercent,
        product.termMonths,
      ),
    [product.regularInstallmentAmount, product.creditAmount, annualRatePercent, product.termMonths],
  );

  const chartData = series.map((point) => ({
    ano: `Ano ${point.year + 1}`,
    carta: Number(point.correctedCredit),
    parcela: Number(point.correctedInstallment),
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setMonth(product.termMonths);
          setScenario("base");
          setCustomRate("");
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Simular</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Simulação — {product.productName}</DialogTitle>
          <DialogDescription>
            Projeção de correção da carta e da parcela ao longo do prazo. Valores estimados, sujeitos ao
            índice real de cada período.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CorrectionSlider month={month} termMonths={product.termMonths} onChange={setMonth} />

          <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Carta nominal</p>
              <p className="font-semibold tabular-nums">{formatCurrency(product.creditAmount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Carta corrigida</p>
              <p className="font-heading text-lg font-semibold text-primary tabular-nums">{formatCurrency(projectedCredit)}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Parcela nominal</p>
              <p className="font-semibold tabular-nums">{formatCurrency(product.regularInstallmentAmount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Parcela no período</p>
              <p className="font-semibold tabular-nums">{formatCurrency(projectedInstallment)}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Total pago até o mês</p>
              <p className="font-semibold tabular-nums">{formatCurrency(projectedTotalPaid)}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Correção acumulada</p>
              <p className="font-semibold tabular-nums">{formatPercent(accumulatedCorrectionPercent)}</p>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="ano" tick={chartAxisTick} tickLine={false} axisLine={false} />
                  <YAxis width={70} tick={chartAxisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCurrency(v)} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                  />
                  <Line type="monotone" dataKey="carta" name="Carta corrigida" stroke={chartSeries.primary} strokeWidth={2} dot={false} {...chartLineAnimation} />
                  <Line type="monotone" dataKey="parcela" name="Parcela corrigida" stroke={chartSeries.comparison} strokeWidth={2} dot={false} {...chartLineAnimation} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-2">
            <Label>Cenário</Label>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Cenário">
              {SCENARIO_OPTIONS.filter((opt) => opt.value !== "custom" || canEditRate).map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={scenario === opt.value ? "default" : "outline"}
                  onClick={() => setScenario(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            {scenario === "custom" && canEditRate && (
              <div className="space-y-1">
                <Label htmlFor="customRate">Taxa anual personalizada (%)</Label>
                <Input
                  id="customRate"
                  placeholder={base.baseRatePercent}
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                />
              </div>
            )}
          </div>

          <AssumptionsBlock assumptions={assumptions} />

          <details className="group space-y-3 rounded-lg border bg-muted/40 px-3 py-2">
            <summary className="cursor-pointer font-medium transition-colors select-none group-open:text-primary">
              Comparar com investimentos
            </summary>
            <div className="space-y-6 pt-2">
              <div>
                <p className="mb-2 text-sm font-medium">Simulação CDI (juros compostos)</p>
                <CdiCompoundSlider
                  cdiAnnualRatePercent={indexes.CDI?.annualRatePercent ?? "0"}
                  creditAmount={product.creditAmount}
                  consortiumAnnualRatePercent={annualRatePercent}
                  termMonths={product.termMonths}
                  defaultMonthlyContribution={product.regularInstallmentAmount}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Comparação por índice</p>
                <InvestmentComparison
                  creditAmount={product.creditAmount}
                  monthlyInstallment={product.regularInstallmentAmount}
                  consortiumAnnualRatePercent={annualRatePercent}
                  termMonths={product.termMonths}
                  indexes={indexes}
                />
              </div>
            </div>
          </details>

          <form action={saveAction} className="space-y-2">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="selectedMonth" value={effectiveMonth} />
            <input type="hidden" name="scenario" value={assumptions.scenario} />
            <input type="hidden" name="indexCode" value={assumptions.indexCode} />
            <input type="hidden" name="annualRatePercent" value={assumptions.annualRatePercent} />
            <input type="hidden" name="rateOrigin" value={assumptions.rateOrigin} />
            <input type="hidden" name="rateUpdatedAt" value={assumptions.rateUpdatedAt} />
            <input type="hidden" name="rateType" value={assumptions.rateType} />
            <input type="hidden" name="adjustmentFrequencyMonths" value={assumptions.adjustmentFrequencyMonths} />
            <input type="hidden" name="monthlyAvailableAmount" value={monthlyAvailableAmount} />
            <input type="hidden" name="monthlyIncome" value={monthlyIncome ?? ""} />
            <input type="hidden" name="cdiAnnualRatePercent" value={indexes.CDI?.annualRatePercent ?? ""} />

            {saveState?.error && (
              <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
                {saveState.error}
              </p>
            )}
            {saveState?.simulationId && (
              <p className="rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success">
                Simulação salva com sucesso.
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={savePending}>
                {savePending ? "Salvando..." : "Salvar simulação"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

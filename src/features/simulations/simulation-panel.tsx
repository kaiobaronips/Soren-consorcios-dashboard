"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import Decimal from "decimal.js";
import { ChevronLeft } from "lucide-react";
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

const SIMULATION_TABS = [
  { value: "bids", label: "Lances" },
  { value: "half-installment", label: "Meia Parcela" },
  { value: "projection", label: "Projeção do Plano" },
  { value: "market", label: "Mercado Financeiro" },
] as const;

type SimulationTab = (typeof SIMULATION_TABS)[number]["value"];

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
  indexes,
  projectedRates,
  canEditRate,
  onBack,
}: {
  product: SimulationPanelProduct;
  indexes: Record<string, FinancialIndex>;
  projectedRates: ProjectedRates;
  canEditRate: boolean;
  onBack: () => void;
}) {
  const [month, setMonth] = useState(product.termMonths);
  const [scenario, setScenario] = useState<Scenario>("base");
  const [customRate, setCustomRate] = useState("");
  const [activeTab, setActiveTab] = useState<SimulationTab>("projection");

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

  const tabId = (tab: SimulationTab) => `simulation-tab-${product.id}-${tab}`;
  const panelId = (tab: SimulationTab) => `simulation-panel-${product.id}-${tab}`;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: SimulationTab) {
    const currentIndex = SIMULATION_TABS.findIndex((tab) => tab.value === currentTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % SIMULATION_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + SIMULATION_TABS.length) % SIMULATION_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = SIMULATION_TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = SIMULATION_TABS[nextIndex].value;
    setActiveTab(nextTab);
    document.getElementById(tabId(nextTab))?.focus();
  }

  return (
    <article className="enterprise-simulation-page">
      <div className="enterprise-simulation-tabs-bar">
        <nav className="enterprise-tabs enterprise-simulation-tabs" role="tablist" aria-label="Opções da simulação">
          {SIMULATION_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                id={tabId(tab.value)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId(tab.value)}
                tabIndex={isActive ? 0 : -1}
                className={`enterprise-tab ${isActive ? "enterprise-tab-active" : ""}`}
                onClick={() => setActiveTab(tab.value)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.value)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          className="enterprise-simulation-tabs-back"
          aria-label="Voltar aos resultados"
          title="Voltar aos resultados"
          onClick={onBack}
        >
          <ChevronLeft aria-hidden />
        </button>
      </div>

      <div className="enterprise-simulation-body">
        {activeTab === "bids" && (
          <section
            id={panelId("bids")}
            role="tabpanel"
            aria-labelledby={tabId("bids")}
            className="enterprise-simulation-section enterprise-simulation-empty-panel"
          >
            <header className="enterprise-simulation-section-header">
              <div>
                <h3 className="enterprise-simulation-section-title">Lances</h3>
                <p className="enterprise-simulation-section-description">Simulações de lance para o plano selecionado.</p>
              </div>
            </header>
            <div className="enterprise-simulation-section-content">
              <p className="enterprise-simulation-empty-message">Nenhuma simulação de lance configurada.</p>
            </div>
          </section>
        )}

        {activeTab === "half-installment" && (
          <section
            id={panelId("half-installment")}
            role="tabpanel"
            aria-labelledby={tabId("half-installment")}
            className="enterprise-simulation-section enterprise-simulation-empty-panel"
          >
            <header className="enterprise-simulation-section-header">
              <div>
                <h3 className="enterprise-simulation-section-title">Meia Parcela</h3>
                <p className="enterprise-simulation-section-description">Condições de meia parcela para o plano selecionado.</p>
              </div>
            </header>
            <div className="enterprise-simulation-section-content">
              <p className="enterprise-simulation-empty-message">Nenhuma condição de meia parcela configurada.</p>
            </div>
          </section>
        )}

        {activeTab === "projection" && (
          <div
            id={panelId("projection")}
            role="tabpanel"
            aria-labelledby={tabId("projection")}
            className="enterprise-simulation-tab-panel"
          >
            <section className="enterprise-simulation-section" aria-labelledby="simulation-projection-title">
              <header className="enterprise-simulation-section-header">
                <div>
                  <h3 id="simulation-projection-title" className="enterprise-simulation-section-title">Projeção do plano</h3>
                  <p className="enterprise-simulation-section-description">Selecione o momento do contrato para atualizar os valores projetados.</p>
                </div>
              </header>
              <div className="enterprise-simulation-section-content">
                <CorrectionSlider month={month} termMonths={product.termMonths} onChange={setMonth} />

                <div className="enterprise-simulation-metrics">
                  <div className="enterprise-simulation-metric">
                    <p>Carta nominal</p>
                    <strong>{formatCurrency(product.creditAmount)}</strong>
                  </div>
                  <div className="enterprise-simulation-metric enterprise-simulation-metric-primary">
                    <p>Carta corrigida</p>
                    <strong>{formatCurrency(projectedCredit)}</strong>
                  </div>
                  <div className="enterprise-simulation-metric">
                    <p>Parcela nominal</p>
                    <strong>{formatCurrency(product.regularInstallmentAmount)}</strong>
                  </div>
                  <div className="enterprise-simulation-metric">
                    <p>Parcela no período</p>
                    <strong>{formatCurrency(projectedInstallment)}</strong>
                  </div>
                  <div className="enterprise-simulation-metric">
                    <p>Total pago até o mês</p>
                    <strong>{formatCurrency(projectedTotalPaid)}</strong>
                  </div>
                  <div className="enterprise-simulation-metric">
                    <p>Correção acumulada</p>
                    <strong>{formatPercent(accumulatedCorrectionPercent)}</strong>
                  </div>
                </div>

                {chartData.length > 0 && (
                  <div className="enterprise-simulation-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
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
              </div>
            </section>

            <section className="enterprise-simulation-section" aria-labelledby="simulation-scenario-title">
              <header className="enterprise-simulation-section-header">
                <div>
                  <h3 id="simulation-scenario-title" className="enterprise-simulation-section-title">Cenário e premissas</h3>
                  <p className="enterprise-simulation-section-description">Defina o cenário de correção usado nos cálculos.</p>
                </div>
              </header>
              <div className="enterprise-simulation-section-content enterprise-simulation-scenario-grid">
                <div className="space-y-2">
                  <Label className="enterprise-field-label">Cenário</Label>
                  <div className="enterprise-simulation-segmented" role="group" aria-label="Cenário">
                    {SCENARIO_OPTIONS.filter((opt) => opt.value !== "custom" || canEditRate).map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        className={`enterprise-button ${
                          scenario === opt.value ? "enterprise-button-primary" : "enterprise-button-secondary"
                        }`}
                        onClick={() => setScenario(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  {scenario === "custom" && canEditRate && (
                    <div className="space-y-1">
                      <Label htmlFor="customRate" className="enterprise-field-label">Taxa anual personalizada (%)</Label>
                      <Input
                        id="customRate"
                        className="enterprise-field-input"
                        placeholder={base.baseRatePercent}
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <AssumptionsBlock assumptions={assumptions} />
              </div>
            </section>
          </div>
        )}

        {activeTab === "market" && (
          <section
            id={panelId("market")}
            role="tabpanel"
            aria-labelledby={tabId("market")}
            className="enterprise-simulation-section"
          >
            <header className="enterprise-simulation-section-header">
              <div>
                <h3 className="enterprise-simulation-section-title">Mercado Financeiro</h3>
                <p className="enterprise-simulation-section-description">Compare o plano com índices e investimentos de mercado.</p>
              </div>
            </header>
            <div className="enterprise-simulation-comparison-content">
              <section className="enterprise-simulation-comparison-section">
                <h3 className="enterprise-simulation-subtitle">Simulação CDI (juros compostos)</h3>
                <CdiCompoundSlider
                  cdiAnnualRatePercent={indexes.CDI?.annualRatePercent ?? "0"}
                  creditAmount={product.creditAmount}
                  consortiumAnnualRatePercent={annualRatePercent}
                  termMonths={product.termMonths}
                  defaultMonthlyContribution={product.regularInstallmentAmount}
                />
              </section>
              <section className="enterprise-simulation-comparison-section">
                <h3 className="enterprise-simulation-subtitle">Comparação por índice</h3>
                <InvestmentComparison
                  creditAmount={product.creditAmount}
                  monthlyInstallment={product.regularInstallmentAmount}
                  consortiumAnnualRatePercent={annualRatePercent}
                  termMonths={product.termMonths}
                  indexes={indexes}
                />
              </section>
            </div>
          </section>
        )}

      </div>
    </article>
  );
}

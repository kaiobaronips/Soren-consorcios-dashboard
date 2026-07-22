"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  chartAxisTick,
  chartGridStroke,
  chartLineAnimation,
  chartSeries,
  chartTooltipContentStyle,
  chartTooltipLabelStyle,
} from "@/components/ui/chart-theme";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cdiCompoundProjection } from "@/domain/financial-calculations";

const CDI_PERCENTAGE_OPTIONS = ["80", "90", "100", "110", "120"] as const;

/**
 * Slider de simulação em juros compostos sobre um percentual do CDI (prompt §17), com
 * comparação direta à carta corrigida do consórcio. Toda a matemática financeira vive no
 * domínio: o componente apenas coleta o estado de UI, chama `cdiCompoundProjection` e
 * renderiza o resultado — nenhum cálculo financeiro aqui.
 */
export function CdiCompoundSlider({
  cdiAnnualRatePercent,
  creditAmount,
  consortiumAnnualRatePercent,
  termMonths,
  defaultMonthlyContribution,
}: {
  cdiAnnualRatePercent: string;
  creditAmount: string;
  consortiumAnnualRatePercent: string;
  termMonths: number;
  defaultMonthlyContribution: string;
}) {
  const maxYears = Math.max(Math.ceil(termMonths / 12), 1);
  const [years, setYears] = useState(maxYears);
  const [cdiPercentage, setCdiPercentage] = useState<string>("100");
  const [customCdiPercentage, setCustomCdiPercentage] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState(defaultMonthlyContribution);
  const [initialAmount, setInitialAmount] = useState("0");
  const [discountTaxes, setDiscountTaxes] = useState(false);
  const [irRatePercent, setIrRatePercent] = useState("15");
  const [adminFeeRatePercent, setAdminFeeRatePercent] = useState("0");

  const isCustomPercentage = !CDI_PERCENTAGE_OPTIONS.includes(cdiPercentage as (typeof CDI_PERCENTAGE_OPTIONS)[number]);
  const effectiveCdiPercentage = isCustomPercentage ? (customCdiPercentage.trim() === "" ? "100" : customCdiPercentage) : cdiPercentage;

  const safeInitialAmount = initialAmount.trim() === "" ? "0" : initialAmount;
  const safeMonthlyContribution = monthlyContribution.trim() === "" ? "0" : monthlyContribution;

  const projection = useMemo(
    () =>
      cdiCompoundProjection({
        cdiAnnualRatePercent,
        cdiPercentage: effectiveCdiPercentage,
        monthlyContribution: safeMonthlyContribution,
        initialAmount: safeInitialAmount,
        years,
        creditAmount,
        consortiumAnnualRatePercent,
        discount: discountTaxes ? { irRatePercent, adminFeeRatePercent } : undefined,
      }),
    [cdiAnnualRatePercent, effectiveCdiPercentage, safeMonthlyContribution, safeInitialAmount, years, creditAmount, consortiumAnnualRatePercent, discountTaxes, irRatePercent, adminFeeRatePercent],
  );

  const {
    effectiveAnnualRatePercent: effectiveAnnualRate,
    totalContributed,
    earnings,
    displayAmount,
    correctedCredit,
    differenceVsCredit,
  } = projection;
  const isNegativeDifference = differenceVsCredit.startsWith("-");

  const chartData = useMemo(
    () =>
      projection.yearly.map((point) => ({
        ano: `Ano ${point.year}`,
        montante: Number(point.balance),
        carta: Number(point.correctedCredit),
      })),
    [projection],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Período (anos)</Label>
          <p className="text-sm text-muted-foreground">{years} ano(s) de {maxYears}</p>
        </div>
        <Slider
          min={1}
          max={maxYears}
          step={1}
          value={[years]}
          onValueChange={(value) => setYears(Array.isArray(value) ? value[0] : value)}
        />
      </div>

      <div className="space-y-2">
        <Label>% do CDI ({formatPercent(cdiAnnualRatePercent)} a.a.)</Label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Percentual do CDI">
          {CDI_PERCENTAGE_OPTIONS.map((opt) => (
            <Button
              key={opt}
              type="button"
              className={`enterprise-button rounded-sm px-4 ${
                !isCustomPercentage && cdiPercentage === opt
                  ? "enterprise-button-primary"
                  : "enterprise-button-secondary"
              }`}
              onClick={() => setCdiPercentage(opt)}
            >
              {opt}%
            </Button>
          ))}
          <Button
            type="button"
            className={`enterprise-button rounded-sm px-4 ${
              isCustomPercentage ? "enterprise-button-primary" : "enterprise-button-secondary"
            }`}
            onClick={() => setCdiPercentage("custom")}
          >
            Personalizado
          </Button>
        </div>
        {isCustomPercentage && (
          <Input
            placeholder="Ex.: 105"
            value={customCdiPercentage}
            onChange={(e) => setCustomCdiPercentage(e.target.value)}
          />
        )}
        <p className="text-xs text-muted-foreground">Taxa efetiva: {formatPercent(effectiveAnnualRate)} a.a.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="cdi-monthly-contribution">Aporte mensal</Label>
          <Input
            id="cdi-monthly-contribution"
            inputMode="decimal"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cdi-initial-amount">Valor inicial (opcional)</Label>
          <Input
            id="cdi-initial-amount"
            inputMode="decimal"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={discountTaxes}
            onChange={(e) => setDiscountTaxes(e.target.checked)}
          />
          Descontar IR / taxa de administração (estimativa simples)
        </label>
        {discountTaxes && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cdi-ir-rate">IR sobre o rendimento (%)</Label>
              <Input id="cdi-ir-rate" inputMode="decimal" value={irRatePercent} onChange={(e) => setIrRatePercent(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cdi-admin-fee">Taxa adm./custódia sobre o montante (%)</Label>
              <Input id="cdi-admin-fee" inputMode="decimal" value={adminFeeRatePercent} onChange={(e) => setAdminFeeRatePercent(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Total aportado</p>
          <p className="font-semibold tabular-nums">{formatCurrency(totalContributed)}</p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Rendimento bruto</p>
          <p className="font-semibold tabular-nums">{formatCurrency(earnings)}</p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Montante {discountTaxes ? "líquido (estimado)" : "bruto"} — estimativa {discountTaxes ? "líquida" : "bruta"}
          </p>
          <p className="font-semibold tabular-nums">{formatCurrency(displayAmount)}</p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Carta corrigida no período</p>
          <p className="font-semibold tabular-nums">{formatCurrency(correctedCredit)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Diferença (montante − carta corrigida)</p>
          <p className={`font-semibold tabular-nums ${isNegativeDifference ? "text-destructive" : "text-success"}`}>
            {formatCurrency(differenceVsCredit)}
          </p>
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
              <Line type="monotone" dataKey="montante" name={discountTaxes ? "Montante líquido" : "Montante bruto"} stroke={chartSeries.primary} strokeWidth={2} dot={false} {...chartLineAnimation} />
              <Line type="monotone" dataKey="carta" name="Carta corrigida" stroke={chartSeries.comparison} strokeWidth={2} dot={false} {...chartLineAnimation} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

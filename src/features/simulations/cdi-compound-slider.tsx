"use client";

import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  applySimpleNetDiscount,
  calculateCompoundFutureValue,
  calculateCorrectedCredit,
  calculateMonthlyContributionFutureValue,
  cdiEffectiveAnnualRate,
} from "@/domain/financial-calculations";

const CDI_PERCENTAGE_OPTIONS = ["80", "90", "100", "110", "120"] as const;

/**
 * Slider de simulação em juros compostos sobre um percentual do CDI (prompt §17), com
 * comparação direta à carta corrigida do consórcio. Toda a matemática financeira vem do
 * domínio (`calculateMonthlyContributionFutureValue`, `calculateCompoundFutureValue`,
 * `cdiEffectiveAnnualRate`, `applySimpleNetDiscount`, `calculateCorrectedCredit`); o
 * componente só monta estado de UI e soma os dois resultados (aporte + capital inicial),
 * uma operação aritmética simples, não uma fórmula financeira nova.
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

  const effectiveAnnualRate = useMemo(
    () => cdiEffectiveAnnualRate(cdiAnnualRatePercent, effectiveCdiPercentage),
    [cdiAnnualRatePercent, effectiveCdiPercentage],
  );

  const months = years * 12;
  const safeInitialAmount = initialAmount.trim() === "" ? "0" : initialAmount;
  const safeMonthlyContribution = monthlyContribution.trim() === "" ? "0" : monthlyContribution;

  const fvContribution = calculateMonthlyContributionFutureValue(safeMonthlyContribution, effectiveAnnualRate, months);
  const fvInitial = calculateCompoundFutureValue(safeInitialAmount, effectiveAnnualRate, String(years));
  const grossAmount = new Decimal(fvContribution).plus(fvInitial).toFixed(2, Decimal.ROUND_HALF_UP);
  const totalContributed = new Decimal(safeMonthlyContribution).times(months).plus(safeInitialAmount).toFixed(2, Decimal.ROUND_HALF_UP);
  const earnings = new Decimal(grossAmount).minus(totalContributed).toFixed(2, Decimal.ROUND_HALF_UP);

  const displayAmount = discountTaxes
    ? applySimpleNetDiscount(grossAmount, earnings, irRatePercent, adminFeeRatePercent)
    : grossAmount;

  const correctedCredit = calculateCorrectedCredit(creditAmount, consortiumAnnualRatePercent, years);
  const differenceVsCredit = new Decimal(displayAmount).minus(correctedCredit).toFixed(2, Decimal.ROUND_HALF_UP);

  const chartData = useMemo(() => {
    const points: { ano: string; montante: number; carta: number }[] = [];
    for (let y = 1; y <= years; y++) {
      const fvC = calculateMonthlyContributionFutureValue(safeMonthlyContribution, effectiveAnnualRate, y * 12);
      const fvI = calculateCompoundFutureValue(safeInitialAmount, effectiveAnnualRate, String(y));
      const yearGross = new Decimal(fvC).plus(fvI).toFixed(2, Decimal.ROUND_HALF_UP);
      const yearEarnings = new Decimal(yearGross).minus(new Decimal(safeMonthlyContribution).times(y * 12).plus(safeInitialAmount)).toFixed(2, Decimal.ROUND_HALF_UP);
      const yearAmount = discountTaxes ? applySimpleNetDiscount(yearGross, yearEarnings, irRatePercent, adminFeeRatePercent) : yearGross;
      points.push({
        ano: `Ano ${y}`,
        montante: Number(yearAmount),
        carta: Number(calculateCorrectedCredit(creditAmount, consortiumAnnualRatePercent, y)),
      });
    }
    return points;
  }, [years, safeMonthlyContribution, safeInitialAmount, effectiveAnnualRate, discountTaxes, irRatePercent, adminFeeRatePercent, creditAmount, consortiumAnnualRatePercent]);

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
              size="sm"
              variant={!isCustomPercentage && cdiPercentage === opt ? "default" : "outline"}
              onClick={() => setCdiPercentage(opt)}
            >
              {opt}%
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={isCustomPercentage ? "default" : "outline"}
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

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total aportado</p>
          <p className="font-medium">{formatCurrency(totalContributed)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Rendimento bruto</p>
          <p className="font-medium">{formatCurrency(earnings)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            Montante {discountTaxes ? "líquido (estimado)" : "bruto"} — estimativa {discountTaxes ? "líquida" : "bruta"}
          </p>
          <p className="font-medium">{formatCurrency(displayAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Carta corrigida no período</p>
          <p className="font-medium">{formatCurrency(correctedCredit)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Diferença (montante − carta corrigida)</p>
          <p className={`font-medium ${new Decimal(differenceVsCredit).isNegative() ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
            {formatCurrency(differenceVsCredit)}
          </p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ano" fontSize={11} />
              <YAxis fontSize={11} width={70} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Line type="monotone" dataKey="montante" name={discountTaxes ? "Montante líquido" : "Montante bruto"} stroke="var(--primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="carta" name="Carta corrigida" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

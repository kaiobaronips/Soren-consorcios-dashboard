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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { FinancialIndex } from "@/repositories/indexes";
import {
  applySimpleNetDiscount,
  compareConsortiumAndInvestments,
  type ComparisonMode,
} from "@/domain/financial-calculations";

type ComparedIndex = "CDI" | "IPCA" | "SAVINGS" | "CUSTOM";

const INDEX_OPTIONS: { value: ComparedIndex; label: string }[] = [
  { value: "CDI", label: "CDI" },
  { value: "IPCA", label: "IPCA" },
  { value: "SAVINGS", label: "Poupança" },
  { value: "CUSTOM", label: "Personalizado" },
];

const MODE_OPTIONS: { value: ComparisonMode; label: string }[] = [
  { value: "monthly_contribution", label: "Modo A — aporte = parcela" },
  { value: "initial_capital", label: "Modo B — capital = carta" },
];

/**
 * Comparação consórcio × investimento (prompt §16/§17): toda a matemática vem de
 * `compareConsortiumAndInvestments` e `applySimpleNetDiscount` (domínio) — o componente só
 * resolve qual taxa/índice usar a partir das props vindas do servidor (`indexes`) e monta a UI.
 */
export function InvestmentComparison({
  creditAmount,
  monthlyInstallment,
  consortiumAnnualRatePercent,
  termMonths,
  indexes,
}: {
  creditAmount: string;
  monthlyInstallment: string;
  consortiumAnnualRatePercent: string;
  termMonths: number;
  indexes: Record<string, FinancialIndex>;
}) {
  const maxYears = Math.max(Math.ceil(termMonths / 12), 1);
  const [selectedIndex, setSelectedIndex] = useState<ComparedIndex>("CDI");
  const [customRate, setCustomRate] = useState("");
  const [mode, setMode] = useState<ComparisonMode>("monthly_contribution");
  const [years, setYears] = useState(maxYears);
  const [discountTaxes, setDiscountTaxes] = useState(false);
  const [irRatePercent, setIrRatePercent] = useState("15");
  const [adminFeeRatePercent, setAdminFeeRatePercent] = useState("0");

  const investmentAnnualRatePercent = useMemo(() => {
    if (selectedIndex === "CUSTOM") return customRate.trim() === "" ? "0" : customRate;
    return indexes[selectedIndex]?.annualRatePercent ?? "0";
  }, [selectedIndex, customRate, indexes]);

  const months = years * 12;

  const result = useMemo(
    () =>
      compareConsortiumAndInvestments({
        mode,
        monthlyInstallment,
        creditAmount,
        months,
        investmentAnnualRatePercent,
        consortiumAnnualRatePercent,
      }),
    [mode, monthlyInstallment, creditAmount, months, investmentAnnualRatePercent, consortiumAnnualRatePercent],
  );

  const netBalance = discountTaxes
    ? applySimpleNetDiscount(result.investmentGross, result.investmentEarnings, irRatePercent, adminFeeRatePercent)
    : null;

  const chartData = result.yearly.map((point) => ({
    ano: `Ano ${point.year}`,
    investimento: Number(point.investmentBalance),
    carta: Number(point.correctedCredit),
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Índice comparado</Label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Índice comparado">
          {INDEX_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={selectedIndex === opt.value ? "default" : "outline"}
              onClick={() => setSelectedIndex(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        {selectedIndex === "CUSTOM" ? (
          <Input placeholder="Taxa anual (%)" value={customRate} onChange={(e) => setCustomRate(e.target.value)} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {indexes[selectedIndex] ? `Taxa: ${formatPercent(indexes[selectedIndex].annualRatePercent)} a.a. (${indexes[selectedIndex].source})` : "Índice sem taxa cadastrada — informe manualmente em Personalizado."}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Modo de comparação</Label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Modo de comparação">
          {MODE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={mode === opt.value ? "default" : "outline"}
              onClick={() => setMode(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

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

      <div className="space-y-2 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={discountTaxes} onChange={(e) => setDiscountTaxes(e.target.checked)} />
          Calcular saldo líquido (IR / taxa de administração — estimativa simples)
        </label>
        {discountTaxes && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ic-ir-rate">IR sobre o rendimento (%)</Label>
              <Input id="ic-ir-rate" inputMode="decimal" value={irRatePercent} onChange={(e) => setIrRatePercent(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ic-admin-fee">Taxa adm./custódia sobre o montante (%)</Label>
              <Input id="ic-admin-fee" inputMode="decimal" value={adminFeeRatePercent} onChange={(e) => setAdminFeeRatePercent(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total aportado</p>
          <p className="font-medium">{formatCurrency(result.totalContributed)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Rendimentos</p>
          <p className="font-medium">{formatCurrency(result.investmentEarnings)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Saldo bruto — estimativa bruta</p>
          <p className="font-medium">{formatCurrency(result.investmentGross)}</p>
        </div>
        {netBalance && (
          <div>
            <p className="text-xs text-muted-foreground">Saldo líquido (estimado)</p>
            <p className="font-medium">{formatCurrency(netBalance)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Taxa do investimento</p>
          <p className="font-medium">{formatPercent(investmentAnnualRatePercent)} a.a.</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Período</p>
          <p className="font-medium">{years} ano(s) ({months} meses)</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Diferença vs. carta corrigida (saldo bruto − carta)</p>
          <p className="font-medium">{formatCurrency(result.differenceVsCredit)}</p>
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
              <Line type="monotone" dataKey="investimento" name="Saldo do investimento" stroke="var(--primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="carta" name="Carta corrigida" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Consórcio e investimento têm objetivos, riscos, liquidez e características diferentes — esta
        comparação é apenas uma referência numérica, não uma recomendação de substituição de um pelo
        outro.
      </p>
    </div>
  );
}

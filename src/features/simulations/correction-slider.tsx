import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { contractYearOfMonth } from "@/domain/financial-calculations";

/**
 * Slider de tempo (0 → termMonths, passo mensal). Puramente apresentacional: só traduz o
 * mês selecionado em rótulo de ano usando `contractYearOfMonth` (função pura do domínio) —
 * nenhuma fórmula financeira aqui.
 */
export function CorrectionSlider({
  month,
  termMonths,
  onChange,
}: {
  month: number;
  termMonths: number;
  onChange: (month: number) => void;
}) {
  const totalYears = Math.ceil(termMonths / 12);
  const currentYear = contractYearOfMonth(Math.max(month, 1)) + 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Momento no plano</Label>
        <p className="text-sm text-muted-foreground">
          Mês {month} de {termMonths} · {currentYear} ano(s) de {totalYears}
        </p>
      </div>
      <Slider
        min={0}
        max={termMonths}
        step={1}
        value={[month]}
        onValueChange={(value) => onChange(Array.isArray(value) ? value[0] : value)}
      />
    </div>
  );
}

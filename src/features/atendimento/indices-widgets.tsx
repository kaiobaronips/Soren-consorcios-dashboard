import { TrendingUp } from "lucide-react";
import { monthlyEquivalentRate } from "@/domain/financial-calculations";
import { formatPercent, formatDate } from "@/lib/format";
import type { FinancialIndex } from "@/repositories/indexes";

/** Índices exibidos, na ordem, com rótulo amigável. */
const INDEX_ORDER: { code: string; label: string; hint: string }[] = [
  { code: "IGPM", label: "IGP-M", hint: "Correção de imóveis" },
  { code: "IPCA", label: "IPCA", hint: "Correção de veículos" },
  { code: "CDI", label: "CDI", hint: "Comparação de investimento" },
  { code: "SAVINGS", label: "Poupança", hint: "Comparação de investimento" },
];

function IndexWidget({ label, hint, index }: { label: string; hint: string; index: FinancialIndex }) {
  const monthly = monthlyEquivalentRate(index.annualRatePercent);
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
            index.projected
              ? "bg-warning-soft text-warning-foreground"
              : "bg-success-soft text-success-foreground"
          }`}
        >
          {index.projected ? "projetada" : "histórica"}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums">{formatPercent(index.annualRatePercent)}</span>
          <span className="text-xs text-muted-foreground">a.a.</span>
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <TrendingUp aria-hidden className="size-3" />
          {formatPercent(monthly)} ao mês (equiv.)
        </p>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t pt-2 text-[0.7rem] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" />
        <span className="truncate" title={index.source}>
          {index.source} · {formatDate(index.updatedAt)}
        </span>
      </div>
    </div>
  );
}

/**
 * Linha de widgets de índices econômicos (dados reais de `financial_indexes`, com origem
 * e data). A taxa mensal exibida é a equivalente calculada pelo domínio — nenhum dado é
 * inventado; índices sem cadastro simplesmente não aparecem.
 */
export function IndicesWidgets({ indexes }: { indexes: Record<string, FinancialIndex> }) {
  const available = INDEX_ORDER.filter((i) => indexes[i.code]);
  if (available.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {available.map((i) => (
        <IndexWidget key={i.code} label={i.label} hint={i.hint} index={indexes[i.code]} />
      ))}
    </div>
  );
}

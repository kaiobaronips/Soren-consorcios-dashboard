"use client";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { RankedProduct } from "@/domain/recommendation";
import { Button } from "@/components/ui/button";
import type { SimulationPanelProduct } from "@/features/simulations/simulation-panel";

const CATEGORY_LABEL: Record<string, string> = { property: "Imóvel", vehicle: "Veículo", other: "Outros" };

export function ResultCards({
  ranked,
  catalogMinInstallment,
  onSimulate,
}: {
  ranked: RankedProduct[];
  catalogMinInstallment?: string | null;
  onSimulate: (product: SimulationPanelProduct) => void;
}) {
  if (ranked.length === 0) {
    return (
      <section className="enterprise-card" data-slot="card">
        <header className="enterprise-card-header">
          <h2 className="enterprise-card-title">Nenhum plano cabe no valor informado</h2>
        </header>
        <div className="enterprise-card-content text-sm text-[color:var(--enterprise-text-secondary)]">
          {catalogMinInstallment ? (
            <p>Menor parcela do catálogo: {formatCurrency(catalogMinInstallment)}</p>
          ) : (
            <p>Não há planos elegíveis para os dados informados.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Planos encontrados">
      <ul className="grid gap-2">
        {ranked.map((item) => {
          const details = [
            ["Prazo", `${item.product.termMonths} meses`],
            [
              "Parcela 1ª–12ª",
              item.product.first12InstallmentAmount
                ? formatCurrency(item.product.first12InstallmentAmount)
                : "—",
            ],
            ["Parcela recorrente", formatCurrency(item.product.regularInstallmentAmount)],
            ["Taxa adm. total", formatPercent(item.product.totalAdministrationFeePercent)],
            ["Índice", item.product.correctionIndex],
            ["Folga mensal", formatCurrency(item.monthlySlack)],
          ];

          return (
            <li
              key={item.product.id}
              data-slot="plan-item"
              className="grid min-w-0 gap-px border border-[color:var(--enterprise-border)] bg-[color:var(--enterprise-border)] lg:grid-cols-[minmax(190px,1.1fr)_minmax(175px,0.8fr)_minmax(0,2.4fr)_auto]"
            >
              <div className="min-w-0 bg-[color:var(--enterprise-surface)] px-4 py-4">
                <h3 className="text-base font-medium leading-5 text-[color:var(--enterprise-text)]">
                  {item.product.productName}
                </h3>
                <p className="mt-1 text-sm leading-5 text-[color:var(--enterprise-text-secondary)]">
                  {item.product.administratorName}
                </p>
                <p className="mt-1 text-xs leading-4 text-[color:var(--enterprise-text-muted)]">
                  {CATEGORY_LABEL[item.product.category]}
                </p>
              </div>

              <div className="bg-[color:var(--enterprise-surface-subtle)] px-4 py-4">
                <p className="text-xs font-medium leading-4 text-[color:var(--enterprise-text-secondary)]">
                  Valor da carta
                </p>
                <p className="mt-1 whitespace-nowrap text-lg font-normal leading-6 text-[color:var(--enterprise-text)] tabular-nums">
                  {formatCurrency(item.product.creditAmount)}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-px bg-[color:var(--enterprise-border)] text-sm sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {details.map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-0 bg-[color:var(--enterprise-surface)] px-3 py-2.5"
                  >
                    <dt className="text-xs leading-4 text-[color:var(--enterprise-text-secondary)]">
                      {label}
                    </dt>
                    <dd className="mt-1 truncate leading-5 text-[color:var(--enterprise-text)] tabular-nums" title={value}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex items-center justify-end bg-[color:var(--enterprise-surface-subtle)] p-3">
                <Button
                  type="button"
                  className="enterprise-button enterprise-button-compact enterprise-button-primary !h-5 !min-h-5 !min-w-[52px] !px-2 !text-[9px] !leading-3 rounded-sm border border-[color:var(--enterprise-blue)] font-medium"
                  onClick={() => onSimulate(item.product)}
                >
                  Simular
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

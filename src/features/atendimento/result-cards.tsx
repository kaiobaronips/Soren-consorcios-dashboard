"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { EligibilityBasis } from "@/domain/eligibility";
import type { RankedProduct, RankingHighlights } from "@/domain/recommendation";

const CATEGORY_LABEL: Record<string, string> = { property: "Imóvel", vehicle: "Veículo", other: "Outros" };
const CATEGORY_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "property", label: "Imóvel" },
  { value: "vehicle", label: "Veículo" },
  { value: "other", label: "Outros" },
];

function highlightBadges(id: string, highlights: RankingHighlights): string[] {
  const labels: string[] = [];
  if (highlights.biggestCredit === id) labels.push("Maior carta");
  if (highlights.lowestInstallment === id) labels.push("Menor parcela");
  if (highlights.shortestTerm === id) labels.push("Menor prazo");
  if (highlights.lowestFee === id) labels.push("Menor taxa");
  if (highlights.bestBalance === id) labels.push("Melhor equilíbrio");
  return labels;
}

function installmentLabel(basis: EligibilityBasis): string {
  if (basis === "first") return "Parcela 1ª–12ª usada na elegibilidade";
  if (basis === "max") return "Maior parcela usada na elegibilidade";
  return "Parcela recorrente usada na elegibilidade";
}

export function ResultCards({
  ranked,
  highlights,
  basis,
  catalogMinInstallment,
}: {
  ranked: RankedProduct[];
  highlights: RankingHighlights;
  basis: EligibilityBasis;
  catalogMinInstallment?: string | null;
}) {
  const [onlyCompatible, setOnlyCompatible] = useState(false);
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    return ranked.filter((item) => {
      if (onlyCompatible && item.classification !== "compatible") return false;
      if (category !== "all" && item.product.category !== category) return false;
      return true;
    });
  }, [ranked, onlyCompatible, category]);

  if (ranked.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 py-8 text-center">
          <p className="font-medium">Nenhum plano cabe no valor informado</p>
          {catalogMinInstallment && (
            <p className="text-sm text-muted-foreground">
              Menor parcela do catálogo: {formatCurrency(catalogMinInstallment)}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={onlyCompatible ? "default" : "outline"}
          onClick={() => setOnlyCompatible((v) => !v)}
        >
          Apenas totalmente compatíveis
        </Button>
        <div className="flex gap-1" role="group" aria-label="Categoria">
          {CATEGORY_FILTERS.map((c) => (
            <Button
              key={c.value}
              size="sm"
              variant={category === c.value ? "default" : "outline"}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} de {ranked.length} plano(s)</p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum plano corresponde aos filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const rankIndex = ranked.indexOf(item);
            const badges = highlightBadges(item.product.id, highlights);
            return (
              <Card key={item.product.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-1">
                    {rankIndex === 0 && <Badge>Plano recomendado</Badge>}
                    <Badge
                      variant={item.classification === "compatible" ? "default" : "secondary"}
                      className={
                        item.classification === "compatible"
                          ? "bg-green-600 text-white [a]:hover:bg-green-600/80"
                          : "bg-yellow-500 text-black [a]:hover:bg-yellow-500/80"
                      }
                    >
                      {item.classification === "compatible" ? "Compatível" : "Atenção: 1ª–12ª acima do disponível"}
                    </Badge>
                    {badges.map((b) => (
                      <Badge key={b} variant="outline">{b}</Badge>
                    ))}
                  </div>
                  <CardTitle>{item.product.productName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.product.administratorName} · {CATEGORY_LABEL[item.product.category]}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-semibold">{formatCurrency(item.product.creditAmount)}</p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Prazo</dt>
                    <dd>{item.product.termMonths} meses</dd>
                    <dt className="text-muted-foreground">Parcela 1ª–12ª</dt>
                    <dd>
                      {item.product.first12InstallmentAmount
                        ? formatCurrency(item.product.first12InstallmentAmount)
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Parcela recorrente</dt>
                    <dd>{formatCurrency(item.product.regularInstallmentAmount)}</dd>
                    <dt className="text-muted-foreground">Taxa adm. total</dt>
                    <dd>{formatPercent(item.product.totalAdministrationFeePercent)}</dd>
                    <dt className="text-muted-foreground">Índice</dt>
                    <dd>{item.product.correctionIndex}</dd>
                    <dt className="text-muted-foreground">Folga mensal</dt>
                    <dd>{formatCurrency(item.monthlySlack)}</dd>
                    {item.incomeCommitmentPercent && (
                      <>
                        <dt className="text-muted-foreground">Comprometimento</dt>
                        <dd>{formatPercent(item.incomeCommitmentPercent)}</dd>
                      </>
                    )}
                  </dl>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">Por que este plano?</summary>
                    <p className="mt-1 text-xs text-muted-foreground">{installmentLabel(basis)}</p>
                    <ul className="mt-1 list-inside list-disc">
                      {item.reasons.map((r) => (
                        <li key={r.label}>
                          {r.label}: {r.points.toFixed(1)} pt(s)
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs font-medium">Pontuação total: {item.score.toFixed(1)}</p>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

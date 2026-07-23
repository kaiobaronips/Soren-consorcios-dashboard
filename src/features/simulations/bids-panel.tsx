"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  calculateBids,
  calculateCorrectedCredit,
  calculateTotalProjectedPayments,
  contractYearOfMonth,
  EMBEDDED_BID_PERCENT,
  type Bid,
} from "@/domain/financial-calculations";
import type { SimulationPanelProduct } from "./simulation-panel";

/** Máscara de moeda BR a partir dos dígitos digitados (ex.: "6000000" → "60.000,00"). */
function formatMoneyInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const cents = digits.padStart(3, "0");
  const integer = cents.slice(0, -2).replace(/^0+(?=\d)/, "");
  const decimal = cents.slice(-2);
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
}

/** Converte a entrada mascarada em string decimal para o domínio (ex.: "60.000,00" → "60000.00"). */
function moneyInputToDecimalString(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "0";
  const padded = digits.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

/** Valor de um componente embutido para PREVIEW (o cálculo autoritativo é `calculateBids`). */
function embeddedPreview(creditAmount: string, percent: number): string {
  return new Decimal(creditAmount).times(percent).div(100).toFixed(2);
}

function bidDescription(bid: Bid, creditAmount: string): string {
  switch (bid.type) {
    case "free":
      return `Lance livre · ${formatCurrency(bid.amount)}`;
    case "embedded25":
      return `Embutido ${EMBEDDED_BID_PERCENT}% · ${formatCurrency(embeddedPreview(creditAmount, EMBEDDED_BID_PERCENT))}`;
    case "embedded25plus25":
      return `Embutido ${EMBEDDED_BID_PERCENT}% + ${EMBEDDED_BID_PERCENT}% · ${formatCurrency(
        embeddedPreview(creditAmount, EMBEDDED_BID_PERCENT * 2),
      )}`;
  }
}

/** Marcadores de tempo (limites de ano, amostrados para prazos longos manterem ~5 rótulos). */
function buildTimelineMarkers(termMonths: number): number[] {
  const totalYears = Math.max(1, Math.ceil(termMonths / 12));
  const yearStep = Math.max(1, Math.ceil(totalYears / 5));
  const markers: number[] = [];
  for (let year = yearStep; year * 12 < termMonths; year += yearStep) markers.push(year * 12);
  markers.push(termMonths);
  return markers;
}

const capClassName =
  "shrink-0 rounded-sm border border-[color:var(--enterprise-border-strong)] bg-[color:var(--enterprise-surface-subtle)] px-3 py-1 text-xs font-medium tabular-nums text-[color:var(--enterprise-text-secondary)]";

/**
 * Aba "Lances" da simulação: evolução do crédito no tempo (slider) + configuração de lances
 * (livre e embutidos fixos em 25%) + resultados. Toda a matemática vive em
 * `@/domain/financial-calculations/bids` — este componente apenas coleta entradas e renderiza.
 */
export function BidsPanel({
  product,
  annualRatePercent,
}: {
  product: SimulationPanelProduct;
  annualRatePercent: string;
}) {
  const [month, setMonth] = useState(1);
  const [bids, setBids] = useState<Bid[]>([]);
  const [freeInput, setFreeInput] = useState("");

  const markers = useMemo(() => buildTimelineMarkers(product.termMonths), [product.termMonths]);

  const totalInvested = useMemo(
    () => calculateTotalProjectedPayments(product.regularInstallmentAmount, annualRatePercent, month),
    [product.regularInstallmentAmount, annualRatePercent, month],
  );
  const correctedCredit = useMemo(
    () => calculateCorrectedCredit(product.creditAmount, annualRatePercent, contractYearOfMonth(month)),
    [product.creditAmount, annualRatePercent, month],
  );

  const result = useMemo(
    () =>
      calculateBids({
        creditAmount: product.creditAmount,
        administrationFeePercent: product.totalAdministrationFeePercent,
        regularInstallmentAmount: product.regularInstallmentAmount,
        termMonths: product.termMonths,
        contemplationMonth: month,
        bids,
      }),
    [product, month, bids],
  );

  function addBid(bid: Bid) {
    setBids((current) => [...current, bid]);
  }

  function addFreeBid() {
    const amount = moneyInputToDecimalString(freeInput);
    if (new Decimal(amount).lte(0)) return;
    addBid({ type: "free", amount });
    setFreeInput("");
  }

  function removeBid(index: number) {
    setBids((current) => current.filter((_, i) => i !== index));
  }

  const yearOfMonth = contractYearOfMonth(month) + 1;

  return (
    <>
      {/* Resumo do plano */}
      <section className="enterprise-simulation-section" aria-labelledby="bids-summary-title">
        <header className="enterprise-simulation-section-header">
          <div>
            <h3 id="bids-summary-title" className="enterprise-simulation-section-title">
              Simulador de lances
            </h3>
            <p className="enterprise-simulation-section-description">{product.productName}</p>
          </div>
        </header>
        <div className="enterprise-simulation-section-content">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-[color:var(--enterprise-text-muted)]">Crédito (carta)</p>
              <strong className="text-base tabular-nums text-[color:var(--enterprise-text)]">
                {formatCurrency(product.creditAmount)}
              </strong>
            </div>
            <div>
              <p className="text-xs text-[color:var(--enterprise-text-muted)]">Prazo</p>
              <strong className="text-base tabular-nums text-[color:var(--enterprise-text)]">
                {product.termMonths} meses
              </strong>
            </div>
            <div>
              <p className="text-xs text-[color:var(--enterprise-text-muted)]">Taxa adm.</p>
              <strong className="text-base tabular-nums text-[color:var(--enterprise-text)]">
                {formatPercent(product.totalAdministrationFeePercent)}
              </strong>
            </div>
            <div>
              <p className="text-xs text-[color:var(--enterprise-text-muted)]">Saldo devedor</p>
              <strong className="text-base tabular-nums text-[color:var(--enterprise-text)]">
                {formatCurrency(result.debtBalance)}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* Evolução do crédito no tempo (barra) */}
      <section className="enterprise-simulation-section" aria-labelledby="bids-timeline-title">
        <header className="enterprise-simulation-section-header">
          <div>
            <h3 id="bids-timeline-title" className="enterprise-simulation-section-title">
              Evolução do crédito no tempo
            </h3>
            <p className="enterprise-simulation-section-description">
              Deslize para ver a carta corrigida e o total investido em cada momento do plano.
            </p>
          </div>
        </header>
        <div className="enterprise-simulation-section-content">
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-sm border border-[color:var(--enterprise-border)] bg-[color:var(--enterprise-surface-subtle)] px-4 py-3">
            <div>
              <p className="text-xs text-[color:var(--enterprise-text-muted)]">Momento</p>
              <strong className="text-sm tabular-nums text-[color:var(--enterprise-text)]">
                Mês {month} · {yearOfMonth}º ano
              </strong>
            </div>
            <div className="text-right">
              <p className="text-xs text-[color:var(--enterprise-text-muted)]">Total investido</p>
              <strong className="text-sm tabular-nums text-[color:var(--enterprise-text)]">
                {formatCurrency(totalInvested)}
              </strong>
            </div>
            <div className="text-right">
              <p className="text-xs text-[color:var(--enterprise-text-muted)]">Carta corrigida</p>
              <strong className="text-sm tabular-nums text-[color:var(--enterprise-blue)]">
                {formatCurrency(correctedCredit)}
              </strong>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className={capClassName}>Mês 1</span>
            <Slider
              className="flex-1"
              min={1}
              max={product.termMonths}
              step={1}
              value={[month]}
              onValueChange={(value) => setMonth(Array.isArray(value) ? value[0] : value)}
              aria-label="Mês da contemplação"
            />
            <span className={capClassName}>{product.termMonths} meses</span>
          </div>

          <div className="mt-2 flex justify-between px-1 text-[11px] tabular-nums text-[color:var(--enterprise-text-muted)]">
            {markers.map((markerMonth) => (
              <span key={markerMonth}>{markerMonth} meses</span>
            ))}
          </div>
        </div>
      </section>

      {/* Configuração de lances */}
      <section className="enterprise-simulation-section" aria-labelledby="bids-config-title">
        <header className="enterprise-simulation-section-header">
          <div>
            <h3 id="bids-config-title" className="enterprise-simulation-section-title">
              Configurar lances
            </h3>
            <p className="enterprise-simulation-section-description">
              Adicione um ou mais lances. Os embutidos têm percentual fixo de {EMBEDDED_BID_PERCENT}%.
            </p>
          </div>
        </header>
        <div className="enterprise-simulation-section-content">
          <div className="grid gap-3 md:grid-cols-3">
            {/* Lance Livre */}
            <div className="enterprise-card flex flex-col gap-3 p-4">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--enterprise-text)]">Lance livre</h4>
                <p className="mt-1 text-xs leading-4 text-[color:var(--enterprise-text-muted)]">
                  Valor livre com recursos próprios. Reduz o saldo devedor, não o crédito.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bid-free-amount" className="enterprise-field-label">
                  Valor do lance
                </Label>
                <Input
                  id="bid-free-amount"
                  className="enterprise-field-input"
                  placeholder="0,00"
                  inputMode="numeric"
                  value={freeInput}
                  onChange={(event) => setFreeInput(formatMoneyInput(event.target.value))}
                />
              </div>
              <Button
                type="button"
                className="enterprise-button enterprise-button-primary mt-auto rounded-sm px-4"
                disabled={freeInput.trim() === ""}
                onClick={addFreeBid}
              >
                <Plus aria-hidden className="size-4" /> Adicionar
              </Button>
            </div>

            {/* Lance embutido 25% */}
            <div className="enterprise-card flex flex-col gap-3 p-4">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--enterprise-text)]">
                  Lance embutido {EMBEDDED_BID_PERCENT}%
                </h4>
                <p className="mt-1 text-xs leading-4 text-[color:var(--enterprise-text-muted)]">
                  {EMBEDDED_BID_PERCENT}% da carta ({formatCurrency(embeddedPreview(product.creditAmount, EMBEDDED_BID_PERCENT))}). Reduz crédito e saldo.
                </p>
              </div>
              <Button
                type="button"
                className="enterprise-button enterprise-button-secondary mt-auto rounded-sm px-4"
                onClick={() => addBid({ type: "embedded25" })}
              >
                <Plus aria-hidden className="size-4" /> Adicionar
              </Button>
            </div>

            {/* Lance embutido 25% + 25% */}
            <div className="enterprise-card flex flex-col gap-3 p-4">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--enterprise-text)]">
                  Embutido {EMBEDDED_BID_PERCENT}% + {EMBEDDED_BID_PERCENT}%
                </h4>
                <p className="mt-1 text-xs leading-4 text-[color:var(--enterprise-text-muted)]">
                  {EMBEDDED_BID_PERCENT * 2}% da carta ({formatCurrency(embeddedPreview(product.creditAmount, EMBEDDED_BID_PERCENT * 2))}). Próprio + carta.
                </p>
              </div>
              <Button
                type="button"
                className="enterprise-button enterprise-button-secondary mt-auto rounded-sm px-4"
                onClick={() => addBid({ type: "embedded25plus25" })}
              >
                <Plus aria-hidden className="size-4" /> Adicionar
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <p className="enterprise-field-label mb-2">Lances adicionados</p>
            {bids.length === 0 ? (
              <p className="text-sm text-[color:var(--enterprise-text-muted)]">Nenhum lance adicionado.</p>
            ) : (
              <ul className="space-y-2">
                {bids.map((bid, index) => (
                  <li
                    key={`${bid.type}-${index}`}
                    className="flex items-center justify-between rounded-sm border border-[color:var(--enterprise-border)] bg-white px-3 py-2"
                  >
                    <span className="text-sm tabular-nums text-[color:var(--enterprise-text)]">
                      {bidDescription(bid, product.creditAmount)}
                    </span>
                    <button
                      type="button"
                      className="text-[color:var(--enterprise-text-muted)] transition-colors hover:text-[#da1e28]"
                      aria-label="Remover lance"
                      onClick={() => removeBid(index)}
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Resultados */}
      <section className="enterprise-simulation-section" aria-labelledby="bids-results-title">
        <header className="enterprise-simulation-section-header">
          <div>
            <h3 id="bids-results-title" className="enterprise-simulation-section-title">
              Resultados
            </h3>
            <p className="enterprise-simulation-section-description">
              Efeito dos lances na contemplação (mês {month}).
            </p>
          </div>
        </header>
        <div className="enterprise-simulation-section-content">
          <div className="enterprise-simulation-metrics">
            <div className="enterprise-simulation-metric enterprise-simulation-metric-primary">
              <p>Crédito liberado</p>
              <strong>{formatCurrency(result.releasedCredit)}</strong>
            </div>
            <div className="enterprise-simulation-metric">
              <p>Lance total</p>
              <strong>{formatCurrency(result.totalBidAmount)}</strong>
            </div>
            <div className="enterprise-simulation-metric">
              <p>Percentual do lance</p>
              <strong>{formatPercent(result.bidPercent)}</strong>
            </div>
            <div className="enterprise-simulation-metric">
              <p>Saldo devedor após</p>
              <strong>{formatCurrency(result.debtBalanceAfter)}</strong>
            </div>
            <div className="enterprise-simulation-metric">
              <p>Parcela após contemplação</p>
              <strong>{formatCurrency(result.installmentAfterReducingInstallment)}</strong>
            </div>
            <div className="enterprise-simulation-metric">
              <p>Prazo após contemplação</p>
              <strong className="tabular-nums">{result.monthsToSettleAfterBid} meses</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

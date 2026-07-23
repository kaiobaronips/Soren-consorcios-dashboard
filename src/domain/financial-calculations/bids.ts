import Decimal from "decimal.js";

/**
 * Cálculo de LANCES de consórcio (aba "Lances" da simulação).
 *
 * Funções puras (zero I/O), precisão decimal com `decimal.js`. A UI só renderiza o
 * resultado — nenhuma fórmula financeira mora no componente React.
 *
 * Regras derivadas dos exemplos de referência do produto:
 *
 *  Saldo devedor = carta × (1 + taxaAdm%).  Ex.: 500.000 × 1,20 = 600.000.
 *
 *  Tipos de lance:
 *   - "free"  (Lance Livre): valor livre em R$, com RECURSOS PRÓPRIOS. Reduz o saldo
 *     devedor pelo valor ofertado; NÃO reduz o crédito (a carta permanece cheia).
 *     Percentual do lance = valorOfertado ÷ saldoDevedor × 100 (leilão por percentual).
 *   - "embedded25" (Lance embutido fixo 25%): 25% da carta, EMBUTIDO. Reduz o crédito e
 *     o saldo devedor em 25% da carta.  Ex.: 500.000 → crédito 375.000 / saldo 475.000.
 *   - "embedded25plus25" (25% próprio + 25% da carta): 50% da carta, ambos embutidos.
 *     Ex.: 500.000 → crédito 250.000 / saldo 350.000.
 *
 *  OBSERVAÇÃO do produto: o percentual do lance embutido é FIXO em 25% (não pode ser
 *  maior nem menor) — por isso não há campo editável para os embutidos, só para o livre.
 *
 *  Efeito do abatimento no plano (o cliente escolhe o destino do valor abatido):
 *   - "installment" (Redução das Parcelas): mantém o prazo restante e recalcula a parcela
 *     (saldoDevedorApós ÷ prazoRestante).
 *   - "term" (Redução do Prazo): mantém a parcela atual e quita o saldo em menos meses.
 */

/** Percentual fixo de cada componente de lance embutido (regra do produto). */
export const EMBEDDED_BID_PERCENT = 25;

export type BidType = "free" | "embedded25" | "embedded25plus25";

export type Bid =
  | { type: "free"; amount: string }
  | { type: "embedded25" }
  | { type: "embedded25plus25" };

/** Destino do valor abatido pelo lance. */
export type ReductionMode = "installment" | "term";

export type BidsResult = {
  /** Carta nominal (crédito contratado). */
  creditAmount: string;
  /** Saldo devedor total do plano = carta × (1 + taxaAdm%). */
  debtBalance: string;
  /** Total embutido (retirado da carta) — reduz o crédito liberado. */
  embeddedBidAmount: string;
  /** Total com recursos próprios (lance livre) — não reduz o crédito. */
  ownBidAmount: string;
  /** Lance total ofertado = embutido + próprio. */
  totalBidAmount: string;
  /** Percentual do lance sobre o saldo devedor (critério do leilão). */
  bidPercent: string;
  /** Crédito liberado na contemplação = carta − embutido. */
  releasedCredit: string;
  /** Saldo devedor após contemplação = saldo devedor − lance total. */
  debtBalanceAfter: string;
  /** Prazo restante no momento da contemplação (termMonths − mês de contemplação). */
  remainingTermBefore: number;
  /** Parcela após contemplação (mantém o prazo restante, reduz a parcela). */
  installmentAfterReducingInstallment: string;
  /** Meses que faltam para quitar a carta após o lance (mantém a parcela, encerra antes). */
  monthsToSettleAfterBid: number;
};

/** Saldo devedor total do plano = carta × (1 + taxaAdm%). */
export function calculateDebtBalance(creditAmount: string, administrationFeePercent: string): string {
  return new Decimal(creditAmount)
    .times(new Decimal(1).plus(new Decimal(administrationFeePercent).div(100)))
    .toFixed(2, Decimal.ROUND_HALF_UP);
}

/** Parte EMBUTIDA de um lance (retirada da carta) — reduz o crédito liberado. */
function embeddedAmountOf(bid: Bid, credit: Decimal): Decimal {
  switch (bid.type) {
    case "free":
      return new Decimal(0);
    case "embedded25":
      return credit.times(EMBEDDED_BID_PERCENT).div(100);
    case "embedded25plus25":
      return credit.times(EMBEDDED_BID_PERCENT * 2).div(100);
  }
}

/** Parte com RECURSOS PRÓPRIOS de um lance (lance livre) — não reduz o crédito. */
function ownAmountOf(bid: Bid): Decimal {
  if (bid.type !== "free") return new Decimal(0);
  const value = new Decimal(bid.amount || "0");
  return value.isFinite() && value.gt(0) ? value : new Decimal(0);
}

/**
 * Calcula o efeito combinado de um conjunto de lances sobre a carta e o saldo devedor,
 * além da parcela/prazo após a contemplação no mês informado.
 */
export function calculateBids(params: {
  creditAmount: string;
  administrationFeePercent: string;
  regularInstallmentAmount: string;
  termMonths: number;
  contemplationMonth: number;
  bids: Bid[];
}): BidsResult {
  const credit = new Decimal(params.creditAmount);
  const debtBalance = new Decimal(calculateDebtBalance(params.creditAmount, params.administrationFeePercent));

  let embedded = new Decimal(0);
  let own = new Decimal(0);
  for (const bid of params.bids) {
    embedded = embedded.plus(embeddedAmountOf(bid, credit));
    own = own.plus(ownAmountOf(bid));
  }
  // O embutido não pode exceder a carta; o lance total não pode exceder o saldo devedor.
  embedded = Decimal.min(embedded, credit);
  const totalBid = Decimal.min(embedded.plus(own), debtBalance);
  // Recalcula o próprio efetivo após o teto (o embutido tem prioridade sobre a carta).
  const effectiveOwn = totalBid.minus(embedded);

  const releasedCredit = credit.minus(embedded);
  const debtBalanceAfter = debtBalance.minus(totalBid);
  const bidPercent = debtBalance.gt(0) ? totalBid.div(debtBalance).times(100) : new Decimal(0);

  const month = Math.min(Math.max(Math.round(params.contemplationMonth), 1), params.termMonths);
  const remainingTermBefore = Math.max(params.termMonths - month, 1);

  // Dívida nominal restante no mês da contemplação (parcela × meses restantes), abatida
  // pelo lance total. Base comum aos dois destinos do valor abatido — ambos reduzem.
  const installment = new Decimal(params.regularInstallmentAmount);
  const remainingPayments = installment.times(remainingTermBefore);
  const remainingAfterBid = Decimal.max(remainingPayments.minus(totalBid), new Decimal(0));

  // Redução das Parcelas: mantém o prazo restante, recalcula a parcela.
  const installmentAfter = remainingAfterBid.div(remainingTermBefore);

  // Meses restantes para quitar: mantém a parcela atual, quita as últimas parcelas.
  const monthsToSettle = installment.gt(0)
    ? remainingAfterBid.div(installment).ceil().toNumber()
    : remainingTermBefore;

  return {
    creditAmount: credit.toFixed(2, Decimal.ROUND_HALF_UP),
    debtBalance: debtBalance.toFixed(2, Decimal.ROUND_HALF_UP),
    embeddedBidAmount: embedded.toFixed(2, Decimal.ROUND_HALF_UP),
    ownBidAmount: effectiveOwn.toFixed(2, Decimal.ROUND_HALF_UP),
    totalBidAmount: totalBid.toFixed(2, Decimal.ROUND_HALF_UP),
    bidPercent: bidPercent.toFixed(2, Decimal.ROUND_HALF_UP),
    releasedCredit: releasedCredit.toFixed(2, Decimal.ROUND_HALF_UP),
    debtBalanceAfter: debtBalanceAfter.toFixed(2, Decimal.ROUND_HALF_UP),
    remainingTermBefore,
    installmentAfterReducingInstallment: Decimal.max(installmentAfter, new Decimal(0)).toFixed(2, Decimal.ROUND_HALF_UP),
    monthsToSettleAfterBid: monthsToSettle,
  };
}

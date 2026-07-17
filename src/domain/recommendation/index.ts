import Decimal from "decimal.js";
import { basisInstallment, type ClassifiedProduct, type EligibilityBasis } from "../eligibility";

export type RankingPreferences = {
  desiredCategory: "property" | "vehicle" | "other" | "all";
  desiredTermMonths: number | null;
};

export type ScoreReason = { label: string; points: number };

export type RankedProduct = ClassifiedProduct & {
  score: number;
  reasons: ScoreReason[];
};

export type RankingHighlights = {
  biggestCredit: string | null;
  lowestInstallment: string | null;
  shortestTerm: string | null;
  lowestFee: string | null;
  bestBalance: string | null;
};

function round2(value: Decimal): number {
  return Number(value.toFixed(2));
}

function scoreCompatibilidade(item: ClassifiedProduct): ScoreReason {
  if (item.classification === "compatible") {
    return { label: "Totalmente compatível", points: 30 };
  }
  if (item.classification === "attention") {
    return { label: "Compatível com atenção", points: 15 };
  }
  return { label: "Incompatível", points: 0 };
}

function scoreValorDaCarta(item: ClassifiedProduct, maiorCartaElegivel: Decimal): ScoreReason {
  const carta = new Decimal(item.product.creditAmount);
  const points = maiorCartaElegivel.gt(0) ? new Decimal(25).times(carta).div(maiorCartaElegivel) : new Decimal(0);
  return { label: "Valor da carta", points: round2(points) };
}

function scoreFolgaMensal(item: ClassifiedProduct, maiorFolgaElegivel: Decimal): ScoreReason {
  const folga = new Decimal(item.monthlySlack);
  const points = folga.lt(0) || maiorFolgaElegivel.lte(0)
    ? new Decimal(0)
    : new Decimal(15).times(folga).div(maiorFolgaElegivel);
  return { label: "Folga mensal", points: round2(points) };
}

function scoreCategoriaDesejada(item: ClassifiedProduct, prefs: RankingPreferences): ScoreReason {
  const match = prefs.desiredCategory === "all" || prefs.desiredCategory === item.product.category;
  return { label: "Categoria desejada", points: match ? 10 : 0 };
}

function scorePrazoDesejado(item: ClassifiedProduct, prefs: RankingPreferences): ScoreReason {
  if (prefs.desiredTermMonths === null) {
    return { label: "Prazo próximo do desejado", points: 10 };
  }
  const desejado = new Decimal(prefs.desiredTermMonths);
  const prazo = new Decimal(item.product.termMonths);
  const diff = prazo.minus(desejado).abs().div(desejado);
  const points = Decimal.max(0, new Decimal(1).minus(diff)).times(10);
  return { label: "Prazo próximo do desejado", points: round2(points) };
}

function scoreTaxaAdministrativa(item: ClassifiedProduct, menorTaxaElegivel: Decimal): ScoreReason {
  const taxa = new Decimal(item.product.totalAdministrationFeePercent);
  const points = taxa.gt(0) ? menorTaxaElegivel.div(taxa).times(10) : new Decimal(0);
  return { label: "Taxa administrativa baixa", points: round2(points) };
}

function compareRanked(a: RankedProduct, b: RankedProduct): number {
  if (b.score !== a.score) return b.score - a.score;
  const cartaA = new Decimal(a.product.creditAmount);
  const cartaB = new Decimal(b.product.creditAmount);
  if (!cartaA.eq(cartaB)) return cartaB.minus(cartaA).toNumber();
  const taxaA = new Decimal(a.product.totalAdministrationFeePercent);
  const taxaB = new Decimal(b.product.totalAdministrationFeePercent);
  if (!taxaA.eq(taxaB)) return taxaA.minus(taxaB).toNumber();
  if (a.product.termMonths !== b.product.termMonths) return a.product.termMonths - b.product.termMonths;
  return a.product.productCode.localeCompare(b.product.productCode);
}

export function rankConsortiumProducts(
  classified: ClassifiedProduct[],
  prefs: RankingPreferences,
  basis: EligibilityBasis,
): { ranked: RankedProduct[]; highlights: RankingHighlights } {
  const maiorCartaElegivel = classified.reduce(
    (max, item) => Decimal.max(max, new Decimal(item.product.creditAmount)),
    new Decimal(0),
  );
  const maiorFolgaElegivel = classified.reduce(
    (max, item) => Decimal.max(max, new Decimal(item.monthlySlack)),
    new Decimal(0),
  );
  const taxas = classified.map((item) => new Decimal(item.product.totalAdministrationFeePercent));
  const menorTaxaElegivel = taxas.length
    ? taxas.reduce((min, taxa) => Decimal.min(min, taxa))
    : new Decimal(0);

  const ranked: RankedProduct[] = classified.map((item) => {
    const reasons: ScoreReason[] = [
      scoreCompatibilidade(item),
      scoreValorDaCarta(item, maiorCartaElegivel),
      scoreFolgaMensal(item, maiorFolgaElegivel),
      scoreCategoriaDesejada(item, prefs),
      scorePrazoDesejado(item, prefs),
      scoreTaxaAdministrativa(item, menorTaxaElegivel),
    ];
    const total = reasons.reduce((acc, r) => acc.plus(r.points), new Decimal(0));
    return { ...item, score: Number(total.toFixed(1)), reasons };
  });

  ranked.sort(compareRanked);

  const highlights = computeHighlights(classified, basis);

  return { ranked, highlights };
}

function computeHighlights(classified: ClassifiedProduct[], basis: EligibilityBasis): RankingHighlights {
  const highlights: RankingHighlights = {
    biggestCredit: null,
    lowestInstallment: null,
    shortestTerm: null,
    lowestFee: null,
    bestBalance: null,
  };

  let biggestCredit: Decimal | null = null;
  let lowestInstallment: Decimal | null = null;
  let shortestTerm: number | null = null;
  let lowestFee: Decimal | null = null;
  let bestBalance: Decimal | null = null;

  for (const item of classified) {
    const carta = new Decimal(item.product.creditAmount);
    const installment = new Decimal(basisInstallment(item.product, basis));
    const fee = new Decimal(item.product.totalAdministrationFeePercent);
    const balance = installment.gt(0) ? carta.div(installment) : new Decimal(0);

    if (biggestCredit === null || carta.gt(biggestCredit)) {
      biggestCredit = carta;
      highlights.biggestCredit = item.product.id;
    }
    if (lowestInstallment === null || installment.lt(lowestInstallment)) {
      lowestInstallment = installment;
      highlights.lowestInstallment = item.product.id;
    }
    if (shortestTerm === null || item.product.termMonths < shortestTerm) {
      shortestTerm = item.product.termMonths;
      highlights.shortestTerm = item.product.id;
    }
    if (lowestFee === null || fee.lt(lowestFee)) {
      lowestFee = fee;
      highlights.lowestFee = item.product.id;
    }
    if (bestBalance === null || balance.gt(bestBalance)) {
      bestBalance = balance;
      highlights.bestBalance = item.product.id;
    }
  }

  return highlights;
}

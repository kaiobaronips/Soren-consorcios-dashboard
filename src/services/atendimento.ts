import Decimal from "decimal.js";
import { listProducts } from "@/repositories/products";
import { getOrgSettings } from "@/repositories/settings";
import {
  calculateIncomeCommitment,
  getEligibleProducts,
  type EligibilityBasis,
  type EligibilityProduct,
} from "@/domain/eligibility";
import { summarizeEligibility, type EligibilitySummary } from "@/domain/eligibility/summary";
import {
  rankConsortiumProducts,
  type RankedProduct,
  type RankingHighlights,
} from "@/domain/recommendation";

export type AtendimentoInput = {
  monthlyAvailableAmount: string;
  monthlyIncome: string | null;
  desiredCategory: "property" | "vehicle" | "other" | "all";
  desiredTermMonths: number | null;
  customCreditAmount: string | null;
};

export type AtendimentoResult = {
  summary: EligibilitySummary;
  ranked: RankedProduct[];
  highlights: RankingHighlights;
  basis: EligibilityBasis;
  basisLabel: string;
  riskAlert: string | null;
  incomeCommitmentPercent: string | null;
};

const BASIS_LABELS: Record<EligibilityBasis, string> = {
  regular: "Parcela recorrente",
  first: "Parcela inicial (1ª–12ª)",
  max: "Maior parcela",
};

function toEligibilityProduct(p: {
  id: string; productName: string; productCode: string; administratorName: string;
  category: "property" | "vehicle" | "other"; creditAmount: string; termMonths: number;
  totalAdministrationFeePercent: string; first12InstallmentAmount: string | null;
  regularInstallmentAmount: string;
  correctionIndex: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
}): EligibilityProduct {
  return {
    id: p.id,
    productName: p.productName,
    productCode: p.productCode,
    administratorName: p.administratorName,
    category: p.category,
    creditAmount: p.creditAmount,
    termMonths: p.termMonths,
    totalAdministrationFeePercent: p.totalAdministrationFeePercent,
    first12InstallmentAmount: p.first12InstallmentAmount,
    regularInstallmentAmount: p.regularInstallmentAmount,
    correctionIndex: p.correctionIndex,
  };
}

/** Substitui a carta do catálogo e recalcula as parcelas na mesma proporção. */
export function applyCustomCreditAmount(
  product: EligibilityProduct,
  customCreditAmount: string,
): EligibilityProduct {
  const originalCredit = new Decimal(product.creditAmount);
  const customCredit = new Decimal(customCreditAmount);
  const ratio = customCredit.div(originalCredit);

  return {
    ...product,
    creditAmount: customCredit.toFixed(2),
    regularInstallmentAmount: new Decimal(product.regularInstallmentAmount)
      .times(ratio)
      .toFixed(2, Decimal.ROUND_HALF_UP),
    first12InstallmentAmount: product.first12InstallmentAmount
      ? new Decimal(product.first12InstallmentAmount)
        .times(ratio)
        .toFixed(2, Decimal.ROUND_HALF_UP)
      : null,
  };
}

/** Orquestra domínio de elegibilidade/ranking com produtos ativos e configurações da organização. */
export async function runAtendimento(input: AtendimentoInput): Promise<AtendimentoResult> {
  const customCreditEnabled = input.customCreditAmount !== null;
  const [products, settings] = await Promise.all([
    listProducts({
      status: "active",
      ...(!customCreditEnabled && input.desiredCategory !== "all"
        ? { category: input.desiredCategory }
        : {}),
      ...(!customCreditEnabled && input.desiredTermMonths !== null
        ? { termMonths: input.desiredTermMonths }
        : {}),
    }),
    getOrgSettings(),
  ]);

  const basis = settings.eligibilityBasis;
  const eligibilityProducts = products
    .map(toEligibilityProduct)
    .map((product) => input.customCreditAmount
      ? applyCustomCreditAmount(product, input.customCreditAmount)
      : product);

  const classified = getEligibleProducts(
    eligibilityProducts,
    input.monthlyAvailableAmount,
    basis,
    input.monthlyIncome,
  );

  const summary = summarizeEligibility(classified, basis, input.monthlyIncome);
  const { ranked, highlights } = rankConsortiumProducts(
    classified,
    customCreditEnabled
      ? { desiredCategory: "all", desiredTermMonths: null }
      : { desiredCategory: input.desiredCategory, desiredTermMonths: input.desiredTermMonths },
    basis,
  );

  const incomeCommitmentPercent = calculateIncomeCommitment(
    input.monthlyAvailableAmount,
    input.monthlyIncome,
  );

  let riskAlert: string | null = null;
  if (incomeCommitmentPercent !== null) {
    const percent = new Decimal(incomeCommitmentPercent);
    if (percent.gt(settings.maxIncomeCommitmentPercent)) {
      riskAlert = `Comprometimento de ${percent.toFixed(0)}% da renda — acima do teto recomendado de ${settings.maxIncomeCommitmentPercent}%`;
    }
  }

  return {
    summary,
    ranked,
    highlights,
    basis,
    basisLabel: BASIS_LABELS[basis],
    riskAlert,
    incomeCommitmentPercent,
  };
}

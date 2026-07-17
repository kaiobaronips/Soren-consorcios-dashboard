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

/** Orquestra domínio de elegibilidade/ranking com produtos ativos e configurações da organização. */
export async function runAtendimento(input: AtendimentoInput): Promise<AtendimentoResult> {
  const [products, settings] = await Promise.all([
    listProducts({
      status: "active",
      ...(input.desiredCategory === "all" ? {} : { category: input.desiredCategory }),
    }),
    getOrgSettings(),
  ]);

  const basis = settings.eligibilityBasis;
  const eligibilityProducts = products.map(toEligibilityProduct);

  const classified = getEligibleProducts(
    eligibilityProducts,
    input.monthlyAvailableAmount,
    basis,
    input.monthlyIncome,
  );

  const summary = summarizeEligibility(classified, basis, input.monthlyIncome);
  const { ranked, highlights } = rankConsortiumProducts(
    classified,
    { desiredCategory: input.desiredCategory, desiredTermMonths: input.desiredTermMonths },
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

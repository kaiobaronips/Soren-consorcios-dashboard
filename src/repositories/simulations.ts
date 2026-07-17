import Decimal from "decimal.js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";
import type { Product } from "@/repositories/products";
import {
  calculateCorrectedCredit,
  calculateTotalProjectedPayments,
  contractYearOfMonth,
  correctedInstallmentForMonth,
  type SimulationAssumptions,
} from "@/domain/financial-calculations";

/**
 * Subconjunto imutável do produto, capturado no momento da simulação.
 * Nunca é refeito a partir do produto "atual" — é o snapshot gravado.
 */
export type SimulationSnapshotInput = {
  product: {
    id: string;
    productName: string;
    creditAmount: string;
    termMonths: number;
    regularInstallmentAmount: string;
    first12InstallmentAmount: string | null;
    totalAdministrationFeePercent: string;
    correctionIndex: string;
  };
  assumptions: SimulationAssumptions;
  selectedMonth: number;
};

export type SimulationComputed = {
  selectedYear: number;
  baseCreditAmount: string;
  projectedCreditAmount: string;
  baseInstallmentAmount: string;
  projectedInstallmentAmount: string;
  projectedTotalPaid: string;
};

/**
 * Função PURA (sem I/O): monta os valores computados a partir do snapshot do produto,
 * das premissas e do mês selecionado. Recebe sempre dados já capturados (nunca busca o
 * produto atual) — é isso que garante que a simulação gravada é imutável (casos 19 e 20).
 */
export function computeSimulation(input: SimulationSnapshotInput): SimulationComputed {
  const { product, assumptions, selectedMonth } = input;
  const selectedYear = contractYearOfMonth(selectedMonth);

  const baseCreditAmount = new Decimal(product.creditAmount).toFixed(2);
  const projectedCreditAmount = calculateCorrectedCredit(
    product.creditAmount, assumptions.annualRatePercent, selectedYear,
  );

  const baseInstallmentAmount = new Decimal(product.regularInstallmentAmount).toFixed(2);
  const projectedInstallmentAmount = correctedInstallmentForMonth(
    product.regularInstallmentAmount, assumptions.annualRatePercent, selectedMonth,
  );

  const projectedTotalPaid = calculateTotalProjectedPayments(
    product.regularInstallmentAmount, assumptions.annualRatePercent, selectedMonth,
  );

  return {
    selectedYear, baseCreditAmount, projectedCreditAmount,
    baseInstallmentAmount, projectedInstallmentAmount, projectedTotalPaid,
  };
}

/**
 * Função PURA: extrai do produto (repositório) o subconjunto de campos que compõem o
 * snapshot gravado na simulação. Chamada no momento do save, com os valores do produto
 * NAQUELE instante — mudanças futuras no produto não afetam simulações já salvas.
 */
export function toProductSnapshot(product: Product): SimulationSnapshotInput["product"] {
  return {
    id: product.id,
    productName: product.productName,
    creditAmount: product.creditAmount,
    termMonths: product.termMonths,
    regularInstallmentAmount: product.regularInstallmentAmount,
    first12InstallmentAmount: product.first12InstallmentAmount,
    totalAdministrationFeePercent: product.totalAdministrationFeePercent,
    correctionIndex: product.correctionIndex,
  };
}

export type SavedSimulation = {
  id: string;
  clientId: string;
  consultantId: string;
  productId: string | null;
  productSnapshot: unknown;
  assumptionsSnapshot: unknown;
  selectedYear: number | null;
  baseCreditAmount: string;
  projectedCreditAmount: string | null;
  baseInstallmentAmount: string;
  projectedInstallmentAmount: string | null;
  projectedTotalPaid: string | null;
  cdiComparisonValue: string | null;
  monthlyAvailableAmount: string;
  monthlyIncome: string | null;
  status: string;
  createdAt: string;
};

const COLUMNS = "id, client_id, consultant_id, product_id, monthly_available_amount_snapshot, monthly_income_snapshot, product_snapshot, assumptions_snapshot, selected_year, base_credit_amount, projected_credit_amount, base_installment_amount, projected_installment_amount, projected_total_paid, cdi_comparison_value, status, created_at";

/**
 * PostgREST devolve colunas NUMERIC como number no JSON (perde zeros à direita).
 * Os campos abaixo chegam como number em runtime mesmo o tipo declarando string;
 * normalizamos com decimal.js para a string canônica antes de expor ao domínio.
 */
type Row = {
  id: string;
  client_id: string;
  consultant_id: string;
  product_id: string | null;
  monthly_available_amount_snapshot: number;
  monthly_income_snapshot: number | null;
  product_snapshot: unknown;
  assumptions_snapshot: unknown;
  selected_year: number | null;
  base_credit_amount: number;
  projected_credit_amount: number | null;
  base_installment_amount: number;
  projected_installment_amount: number | null;
  projected_total_paid: number | null;
  cdi_comparison_value: number | null;
  status: string;
  created_at: string;
};

function toSavedSimulation(r: Row): SavedSimulation {
  return {
    id: r.id,
    clientId: r.client_id,
    consultantId: r.consultant_id,
    productId: r.product_id,
    productSnapshot: r.product_snapshot,
    assumptionsSnapshot: r.assumptions_snapshot,
    selectedYear: r.selected_year,
    baseCreditAmount: new Decimal(r.base_credit_amount).toFixed(2),
    projectedCreditAmount: r.projected_credit_amount === null
      ? null : new Decimal(r.projected_credit_amount).toFixed(2),
    baseInstallmentAmount: new Decimal(r.base_installment_amount).toFixed(2),
    projectedInstallmentAmount: r.projected_installment_amount === null
      ? null : new Decimal(r.projected_installment_amount).toFixed(2),
    projectedTotalPaid: r.projected_total_paid === null
      ? null : new Decimal(r.projected_total_paid).toFixed(2),
    cdiComparisonValue: r.cdi_comparison_value === null
      ? null : new Decimal(r.cdi_comparison_value).toFixed(2),
    monthlyAvailableAmount: new Decimal(r.monthly_available_amount_snapshot).toFixed(2),
    monthlyIncome: r.monthly_income_snapshot === null
      ? null : new Decimal(r.monthly_income_snapshot).toFixed(2),
    status: r.status,
    createdAt: r.created_at,
  };
}

/**
 * Grava a simulação com snapshot imutável: product_snapshot e assumptions_snapshot são os
 * valores capturados em `input`, não uma referência ao produto atual. Os campos computados
 * são derivados aqui via `computeSimulation` (pura), a partir do mesmo snapshot.
 */
export async function saveSimulation(params: {
  clientId: string;
  productId: string;
  input: SimulationSnapshotInput;
  monthlyAvailableAmount: string;
  monthlyIncome: string | null;
}): Promise<string> {
  const profile = await getCurrentProfile();
  const computed = computeSimulation(params.input);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("simulations").insert({
    organization_id: profile.organizationId,
    client_id: params.clientId,
    consultant_id: profile.id,
    product_id: params.productId,
    monthly_available_amount_snapshot: params.monthlyAvailableAmount,
    monthly_income_snapshot: params.monthlyIncome,
    product_snapshot: params.input.product,
    assumptions_snapshot: params.input.assumptions,
    selected_year: computed.selectedYear,
    base_credit_amount: computed.baseCreditAmount,
    projected_credit_amount: computed.projectedCreditAmount,
    base_installment_amount: computed.baseInstallmentAmount,
    projected_installment_amount: computed.projectedInstallmentAmount,
    projected_total_paid: computed.projectedTotalPaid,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

/** Lista simulações do cliente, mais recentes primeiro. RLS filtra por papel/org. */
export async function listSimulationsByClient(clientId: string): Promise<SavedSimulation[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("simulations").select(COLUMNS)
    .eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toSavedSimulation);
}

export async function getSimulation(id: string): Promise<SavedSimulation | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("simulations").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toSavedSimulation(data as Row) : null;
}

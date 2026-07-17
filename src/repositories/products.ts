import Decimal from "decimal.js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";

export type Product = {
  id: string; productName: string; productCode: string; administratorName: string;
  category: "property" | "vehicle" | "other";
  creditAmount: string; termMonths: number;
  totalAdministrationFeePercent: string;
  first12InstallmentAmount: string | null; regularInstallmentAmount: string;
  correctionIndex: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
  status: "draft" | "active" | "inactive" | "archived"; isDemo: boolean;
};

export type ProductFilters = {
  category?: Product["category"];
  status?: Product["status"];
  search?: string;
};

const COLUMNS = "id, product_name, product_code, administrator_name, category, credit_amount, term_months, total_administration_fee_percent, first_12_installment_amount, regular_installment_amount, correction_index, status, is_demo";

/**
 * PostgREST devolve colunas NUMERIC como number no JSON (perde zeros à direita).
 * Os campos abaixo chegam como number em runtime mesmo o tipo declarando string;
 * normalizamos com decimal.js para a string canônica antes de expor ao domínio.
 */
export type Row = {
  id: string; product_name: string; product_code: string; administrator_name: string;
  category: Product["category"]; credit_amount: number; term_months: number;
  total_administration_fee_percent: number; first_12_installment_amount: number | null;
  regular_installment_amount: number; correction_index: Product["correctionIndex"];
  status: Product["status"]; is_demo: boolean;
};

export function toProduct(r: Row): Product {
  return {
    id: r.id, productName: r.product_name, productCode: r.product_code,
    administratorName: r.administrator_name, category: r.category,
    creditAmount: new Decimal(r.credit_amount).toFixed(2),
    termMonths: r.term_months,
    totalAdministrationFeePercent: new Decimal(r.total_administration_fee_percent).toFixed(3),
    first12InstallmentAmount: r.first_12_installment_amount === null
      ? null
      : new Decimal(r.first_12_installment_amount).toFixed(2),
    regularInstallmentAmount: new Decimal(r.regular_installment_amount).toFixed(2),
    correctionIndex: r.correction_index, status: r.status, isDemo: r.is_demo,
  };
}

/** Lista produtos da organização do usuário (RLS aplica o filtro de org). */
export async function listProducts(filters: ProductFilters): Promise<Product[]> {
  const supabase = await createServerSupabase();
  let q = supabase.from("consortium_products").select(COLUMNS)
    .order("category").order("credit_amount", { ascending: false }).order("term_months");
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.search) {
    // Vírgulas e parênteses quebram a sintaxe do .or(...) do PostgREST; removemos antes de montar o filtro.
    const term = filters.search.replace(/[,()]/g, " ").trim();
    if (term) q = q.or(`product_name.ilike.%${term}%,product_code.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as Row[]).map(toProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("consortium_products").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toProduct(data as Row) : null;
}

/** RLS (policy products_write) garante que apenas admin/manager conseguem. */
export async function setProductStatus(id: string, status: "active" | "inactive"): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("consortium_products").update({ status }).eq("id", id);
  if (error) throw error;
}

export type NewProduct = {
  productName: string; productCode: string; administratorName: string;
  category: Product["category"]; creditAmount: string; termMonths: number;
  totalAdministrationFeePercent: string; regularInstallmentAmount: string;
  first12InstallmentAmount: string | null; correctionIndex: Product["correctionIndex"];
};

/** Insere produto manual (status active, is_demo false). RLS restringe a staff. Retorna o id. */
export async function insertProduct(p: NewProduct): Promise<string> {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("consortium_products").insert({
    organization_id: profile.organizationId,
    product_name: p.productName, product_code: p.productCode,
    administrator_name: p.administratorName, category: p.category,
    credit_amount: p.creditAmount, term_months: p.termMonths,
    total_administration_fee_percent: p.totalAdministrationFeePercent,
    regular_installment_amount: p.regularInstallmentAmount,
    first_12_installment_amount: p.first12InstallmentAmount,
    correction_index: p.correctionIndex,
    correction_frequency_months: 12,
    status: "active", is_demo: false,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

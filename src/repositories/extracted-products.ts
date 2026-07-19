import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";
import type { ExtractedProduct } from "@/lib/pdf/parse-products";

/**
 * Repository da staging `extracted_products` (revisão humana da extração de PDF).
 * RLS restringe tudo a staff da organização; ainda assim carimbamos organization_id
 * no insert (a coluna é not null e as policies exigem `= current_org_id()`).
 */

export type ExtractionReviewStatus = "pending_review" | "approved" | "rejected" | "published";

type FieldColumns = {
  valueColumn: string;
  confidenceColumn: string;
  rawColumn: string;
};

/** Mapa campo(ExtractedProduct) -> trio de colunas na tabela. */
const FIELD_COLUMNS: Record<
  | "productName"
  | "productCode"
  | "creditAmount"
  | "termMonths"
  | "totalAdministrationFeePercent"
  | "regularInstallmentAmount"
  | "first12InstallmentAmount",
  FieldColumns
> = {
  productName: {
    valueColumn: "product_name_value",
    confidenceColumn: "product_name_confidence",
    rawColumn: "product_name_raw",
  },
  productCode: {
    valueColumn: "product_code_value",
    confidenceColumn: "product_code_confidence",
    rawColumn: "product_code_raw",
  },
  creditAmount: {
    valueColumn: "credit_amount_value",
    confidenceColumn: "credit_amount_confidence",
    rawColumn: "credit_amount_raw",
  },
  termMonths: {
    valueColumn: "term_months_value",
    confidenceColumn: "term_months_confidence",
    rawColumn: "term_months_raw",
  },
  totalAdministrationFeePercent: {
    valueColumn: "total_administration_fee_percent_value",
    confidenceColumn: "total_administration_fee_percent_confidence",
    rawColumn: "total_administration_fee_percent_raw",
  },
  regularInstallmentAmount: {
    valueColumn: "regular_installment_amount_value",
    confidenceColumn: "regular_installment_amount_confidence",
    rawColumn: "regular_installment_amount_raw",
  },
  first12InstallmentAmount: {
    valueColumn: "first_12_installment_amount_value",
    confidenceColumn: "first_12_installment_amount_confidence",
    rawColumn: "first_12_installment_amount_raw",
  },
};

/** Constrói a linha de insert (por campo: value/confidence/raw) para um produto extraído. */
function toRow(organizationId: string, documentId: string, product: ExtractedProduct): Record<string, unknown> {
  const row: Record<string, unknown> = {
    organization_id: organizationId,
    document_id: documentId,
    page: product.page,
    overall_confidence: product.overallConfidence,
    issues: product.issues,
    review_status: "pending_review",
  };
  for (const [field, columns] of Object.entries(FIELD_COLUMNS)) {
    const extracted = product[field as keyof typeof FIELD_COLUMNS];
    row[columns.valueColumn] = extracted.value;
    row[columns.confidenceColumn] = extracted.confidence;
    row[columns.rawColumn] = extracted.raw;
  }
  return row;
}

/**
 * Substitui os candidatos `pending_review` do documento pelos recém-extraídos.
 * Aprovados/rejeitados/publicados anteriores permanecem intocados (reprocessamento
 * com novo mapping não descarta trabalho humano já feito). Retorna quantos foram gravados.
 */
export async function replacePendingExtractedProducts(
  documentId: string,
  products: ExtractedProduct[],
): Promise<number> {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();

  // Remove apenas os pendentes; o restante (approved/rejected/published) é preservado.
  const { error: deleteError } = await supabase
    .from("extracted_products")
    .delete()
    .eq("document_id", documentId)
    .eq("review_status", "pending_review");
  if (deleteError) throw deleteError;

  if (products.length === 0) return 0;

  const rows = products.map((p) => toRow(profile.organizationId, documentId, p));
  const { error: insertError } = await supabase.from("extracted_products").insert(rows);
  if (insertError) throw insertError;

  return rows.length;
}

/** Conta os candidatos de um documento por status (usado por telas de revisão/testes). */
export async function countExtractedProducts(
  documentId: string,
  status?: ExtractionReviewStatus,
): Promise<number> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("extracted_products")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId);
  if (status) query = query.eq("review_status", status);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

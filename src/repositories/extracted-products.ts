import Decimal from "decimal.js";
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

/** Campos extraídos de um produto (os 7 editáveis na revisão). */
export type ExtractedFieldKey =
  | "productName"
  | "productCode"
  | "creditAmount"
  | "termMonths"
  | "totalAdministrationFeePercent"
  | "regularInstallmentAmount"
  | "first12InstallmentAmount";

/** Mapa campo(ExtractedProduct) -> trio de colunas na tabela. */
const FIELD_COLUMNS: Record<ExtractedFieldKey, FieldColumns> = {
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

/** Um campo do candidato como chega para a revisão (valor normalizado + confiança + texto cru). */
export type ReviewField = { value: string | null; confidence: number; raw: string | null };

/** Um produto candidato, montado para a UI de revisão humana. */
export type ExtractedProductRecord = {
  id: string;
  documentId: string;
  page: number;
  productName: ReviewField;
  productCode: ReviewField;
  creditAmount: ReviewField;
  termMonths: ReviewField;
  totalAdministrationFeePercent: ReviewField;
  regularInstallmentAmount: ReviewField;
  first12InstallmentAmount: ReviewField;
  overallConfidence: number;
  issues: string[];
  reviewStatus: ExtractionReviewStatus;
  publishedProductId: string | null;
};

// Casas decimais canônicas por campo (NUMERIC chega como number do PostgREST; perde zeros à direita).
const FIELD_DECIMALS: Partial<Record<ExtractedFieldKey, number>> = {
  creditAmount: 2,
  regularInstallmentAmount: 2,
  first12InstallmentAmount: 2,
  totalAdministrationFeePercent: 3,
};

/** Normaliza o valor cru do banco para string canônica (money 2 casas, taxa 3, prazo inteiro). */
function normalizeFieldValue(field: ExtractedFieldKey, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const decimals = FIELD_DECIMALS[field];
  if (decimals !== undefined) return new Decimal(raw as Decimal.Value).toFixed(decimals);
  if (field === "termMonths") return String(raw);
  return String(raw);
}

const SELECT_COLUMNS = [
  "id",
  "document_id",
  "page",
  "overall_confidence",
  "issues",
  "review_status",
  "published_product_id",
  ...Object.values(FIELD_COLUMNS).flatMap((c) => [c.valueColumn, c.confidenceColumn, c.rawColumn]),
].join(", ");

function toRecord(row: Record<string, unknown>): ExtractedProductRecord {
  const fields = {} as Record<ExtractedFieldKey, ReviewField>;
  for (const [field, columns] of Object.entries(FIELD_COLUMNS) as [ExtractedFieldKey, FieldColumns][]) {
    fields[field] = {
      value: normalizeFieldValue(field, row[columns.valueColumn]),
      confidence: Number(row[columns.confidenceColumn] ?? 0),
      raw: (row[columns.rawColumn] as string | null) ?? null,
    };
  }
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    page: row.page as number,
    overallConfidence: Number(row.overall_confidence ?? 0),
    issues: Array.isArray(row.issues) ? (row.issues as string[]) : [],
    reviewStatus: row.review_status as ExtractionReviewStatus,
    publishedProductId: (row.published_product_id as string | null) ?? null,
    ...fields,
  };
}

/** Lista os candidatos de um documento (ordenados por página) para a tela de revisão. */
export async function listByDocument(documentId: string): Promise<ExtractedProductRecord[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("extracted_products")
    .select(SELECT_COLUMNS)
    .eq("document_id", documentId)
    .order("page")
    .order("created_at");
  if (error) throw error;
  return (data as unknown as Record<string, unknown>[]).map(toRecord);
}

/** Um único candidato por id (para validar/publicar). RLS restringe à org staff. */
export async function getExtractedProduct(id: string): Promise<ExtractedProductRecord | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("extracted_products")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data as unknown as Record<string, unknown>) : null;
}

/**
 * Edita um campo de um candidato: grava valor normalizado, marca a confiança como
 * manual (100), recalcula a confiança geral e carimba edited_by/edited_at.
 */
export async function updateField(
  id: string,
  field: ExtractedFieldKey,
  value: string | null,
): Promise<void> {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();

  const current = await getExtractedProduct(id);
  if (!current) throw new Error("Produto extraído não encontrado");

  const columns = FIELD_COLUMNS[field];
  const manualConfidence = value === null ? 0 : 100;

  // Recalcula a confiança geral (média dos 7 campos) com o novo valor manual.
  const confidences = (Object.keys(FIELD_COLUMNS) as ExtractedFieldKey[]).map((f) =>
    f === field ? manualConfidence : current[f].confidence,
  );
  const overall = Math.round(confidences.reduce((sum, c) => sum + c, 0) / confidences.length);

  const patch: Record<string, unknown> = {
    [columns.valueColumn]: value,
    [columns.confidenceColumn]: manualConfidence,
    overall_confidence: overall,
    edited_by: profile.id,
    edited_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("extracted_products").update(patch).eq("id", id);
  if (error) throw error;
}

/** Transiciona o status de revisão (aprovar/rejeitar/publicar). */
export async function setReviewStatus(
  id: string,
  status: ExtractionReviewStatus,
  publishedProductId?: string,
): Promise<void> {
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = { review_status: status };
  if (publishedProductId !== undefined) patch.published_product_id = publishedProductId;
  const { error } = await supabase.from("extracted_products").update(patch).eq("id", id);
  if (error) throw error;
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

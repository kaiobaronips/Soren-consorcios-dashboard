"use server";

import Decimal from "decimal.js";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";
import { findDocumentByHash, insertDocument, updateDocumentStatus } from "@/repositories/documents";
import { logAudit } from "@/repositories/audit";
import { hasPdfMagicBytes, sanitizeFileName, sha256Hex } from "@/lib/pdf/upload-validation";
import { processDocument } from "@/services/pdf-pipeline";
import type { ColumnMapping } from "@/lib/pdf/parse-products";
import { parseBrlMoney, parseBrlPercent, parseIntSafe } from "@/lib/pdf/parse-values";
import {
  getExtractedProduct,
  listByDocument,
  countExtractedProducts,
  setReviewStatus,
  updateField,
  type ExtractedFieldKey,
  type ExtractedProductRecord,
} from "@/repositories/extracted-products";
import {
  findDuplicateProduct,
  insertPublishedProduct,
  updatePublishedProduct,
  type Product,
  type PublishProductInput,
} from "@/repositories/products";
import { maxPdfSizeBytes } from "./schema";

const BUCKET = "product-documents";

export type UploadDocumentState = {
  error?: string;
  documentId?: string;
  productsFound?: number;
  published?: number;
  /** Preenchido quando o hash já existia: o documento não é reprocessado. */
  duplicateOf?: string;
};

export async function uploadDocumentAction(
  _prev: UploadDocumentState | undefined,
  formData: FormData,
): Promise<UploadDocumentState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo PDF" };

  const maxBytes = maxPdfSizeBytes();
  if (file.size > maxBytes) {
    return { error: `Arquivo excede o limite de ${Math.round(maxBytes / (1024 * 1024))} MB` };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Não confiamos no MIME do browser: validamos a assinatura real do conteúdo.
  if (!hasPdfMagicBytes(bytes)) return { error: "O arquivo não é um PDF válido" };

  const fileName = sanitizeFileName(file.name);
  const hash = sha256Hex(bytes);

  // Dedup por hash: se já existe, devolve a referência sem subir nem reprocessar.
  const existing = await findDocumentByHash(hash);
  if (existing) return { duplicateOf: existing.id };

  const storagePath = `${profile.organizationId}/${hash}-${fileName}`;
  const supabase = await createServerSupabase();
  // Client server-side com a sessão do usuário: as storage policies (staff + prefixo da org) valem de verdade.
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) return { error: `Falha ao enviar o arquivo: ${uploadError.message}` };

  const documentId = await insertDocument({
    fileName,
    storagePath,
    mimeType: "application/pdf",
    fileHash: hash,
  });

  await logAudit({
    action: "document.upload",
    entityType: "product_documents",
    entityId: documentId,
    newState: { fileName, storagePath, fileHash: hash },
  });

  const processed = await processDocument(documentId);
  const autoPublish = processed.status === "review_required"
    ? await autoPublishDocumentProducts(documentId, { administratorName: fileName.replace(/\.pdf$/i, "") })
    : { published: 0 };

  await logAudit({
    action: "document.auto_publish",
    entityType: "product_documents",
    entityId: documentId,
    newState: { productsFound: processed.productsFound, published: autoPublish.published },
  });

  revalidatePath("/base-produtos");
  revalidatePath("/produtos");
  return { documentId, productsFound: processed.productsFound, published: autoPublish.published };
}

// Índice de coluna >= 0 por campo; sobrepõe a inferência do parser no reprocessamento.
const columnMappingSchema = z
  .object({
    productName: z.number().int().min(0),
    productCode: z.number().int().min(0),
    creditAmount: z.number().int().min(0),
    termMonths: z.number().int().min(0),
    totalAdministrationFeePercent: z.number().int().min(0),
    regularInstallmentAmount: z.number().int().min(0),
    first12InstallmentAmount: z.number().int().min(0),
  })
  .partial();

const processDocumentSchema = z.object({
  documentId: z.string().uuid("Documento inválido"),
  manualMapping: columnMappingSchema.optional(),
});

export type ProcessDocumentInput = z.infer<typeof processDocumentSchema>;

export type ProcessDocumentState = {
  error?: string;
  productsFound?: number;
  published?: number;
  status?: "review_required" | "completed" | "failed";
};

/**
 * Dispara o pipeline de extração de um documento já enviado. Staff apenas.
 * Produtos completos são publicados automaticamente; itens incompletos ficam em revisão.
 */
export async function processDocumentAction(input: ProcessDocumentInput): Promise<ProcessDocumentState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };

  const parsed = processDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Entrada inválida" };

  const { documentId, manualMapping } = parsed.data;

  try {
    const result = await processDocument(documentId, manualMapping as ColumnMapping | undefined);
    const autoPublish = result.status === "review_required"
      ? await autoPublishDocumentProducts(documentId)
      : { published: 0, pending: 0 };
    const status = autoPublish.published > 0 && autoPublish.pending === 0 ? "completed" : result.status;
    await logAudit({
      action: "document.process",
      entityType: "product_documents",
      entityId: documentId,
      newState: { productsFound: result.productsFound, published: autoPublish.published },
    });
    revalidatePath("/base-produtos");
    revalidatePath("/produtos");
    return { productsFound: result.productsFound, published: autoPublish.published, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar o documento";
    return { error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Revisão humana + publicação (§8.5, §8.7–8.9). Staff apenas.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_VALUES = ["property", "vehicle", "other"] as const;
const CORRECTION_VALUES = ["IGPM", "IPCA", "INCC", "NONE", "CUSTOM"] as const;
const EDITABLE_FIELDS: readonly ExtractedFieldKey[] = [
  "productName",
  "productCode",
  "creditAmount",
  "termMonths",
  "totalAdministrationFeePercent",
  "regularInstallmentAmount",
  "first12InstallmentAmount",
];

/** Reprocessa o documento com um mapeamento manual de colunas escolhido na revisão. */
const remapSchema = z.object({
  documentId: z.string().uuid("Documento inválido"),
  mapping: columnMappingSchema,
});

export async function remapColumnsAction(input: {
  documentId: string;
  mapping: ColumnMapping;
}): Promise<ProcessDocumentState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };

  const parsed = remapSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Entrada inválida" };
  if (Object.keys(parsed.data.mapping).length === 0) return { error: "Selecione ao menos uma coluna" };

  try {
    const result = await processDocument(parsed.data.documentId, parsed.data.mapping as ColumnMapping);
    await logAudit({
      action: "document.remap",
      entityType: "product_documents",
      entityId: parsed.data.documentId,
      newState: { mapping: parsed.data.mapping, productsFound: result.productsFound },
    });
    revalidatePath(`/base-produtos/${parsed.data.documentId}`);
    revalidatePath("/base-produtos");
    return { productsFound: result.productsFound, status: result.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao reprocessar o documento";
    return { error: message };
  }
}

export type ExtractedProductActionState = { error?: string; success?: boolean };

/** Converte o texto digitado pelo revisor no valor normalizado do campo (ou null se vazio). */
function parseFieldValue(field: ExtractedFieldKey, raw: string): { value: string | null } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  if (field === "productName" || field === "productCode") return { value: trimmed };
  if (field === "termMonths") {
    const n = parseIntSafe(trimmed);
    return n === null ? { error: "Prazo inválido" } : { value: String(n) };
  }
  if (field === "totalAdministrationFeePercent") {
    const p = parseBrlPercent(trimmed);
    return p === null ? { error: "Taxa inválida" } : { value: p };
  }
  const money = parseBrlMoney(trimmed);
  return money === null ? { error: "Valor monetário inválido" } : { value: money };
}

const updateFieldSchema = z.object({
  id: z.string().uuid(),
  field: z.enum(EDITABLE_FIELDS as unknown as [ExtractedFieldKey, ...ExtractedFieldKey[]]),
  value: z.string(),
});

/** Edita um campo de um candidato extraído. Marca a confiança como manual (100). */
export async function updateExtractedProductAction(input: {
  id: string;
  field: ExtractedFieldKey;
  value: string;
}): Promise<ExtractedProductActionState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };

  const parsed = updateFieldSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Entrada inválida" };

  const parsedValue = parseFieldValue(parsed.data.field, parsed.data.value);
  if ("error" in parsedValue) return { error: parsedValue.error };

  try {
    const before = await getExtractedProduct(parsed.data.id);
    if (!before) return { error: "Produto extraído não encontrado" };
    await updateField(parsed.data.id, parsed.data.field, parsedValue.value);
    await logAudit({
      action: "extracted_product.edit",
      entityType: "extracted_products",
      entityId: parsed.data.id,
      previousState: { [parsed.data.field]: before[parsed.data.field].value },
      newState: { [parsed.data.field]: parsedValue.value },
    });
    revalidatePath(`/base-produtos/${before.documentId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar o campo";
    return { error: message };
  }
}

const idSchema = z.object({ id: z.string().uuid() });

/** Aprovação humana individual de um candidato (pré-requisito para publicar). */
export async function approveExtractedAction(input: { id: string }): Promise<ExtractedProductActionState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrada inválida" };

  const record = await getExtractedProduct(parsed.data.id);
  if (!record) return { error: "Produto extraído não encontrado" };
  if (record.reviewStatus === "published") return { error: "Produto já publicado" };

  await setReviewStatus(parsed.data.id, "approved");
  await logAudit({
    action: "extracted_product.approve",
    entityType: "extracted_products",
    entityId: parsed.data.id,
  });
  revalidatePath(`/base-produtos/${record.documentId}`);
  return { success: true };
}

/** Rejeita um candidato (não será publicado). */
export async function rejectExtractedAction(input: { id: string }): Promise<ExtractedProductActionState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrada inválida" };

  const record = await getExtractedProduct(parsed.data.id);
  if (!record) return { error: "Produto extraído não encontrado" };
  if (record.reviewStatus === "published") return { error: "Produto já publicado" };

  await setReviewStatus(parsed.data.id, "rejected");
  await logAudit({
    action: "extracted_product.reject",
    entityType: "extracted_products",
    entityId: parsed.data.id,
  });
  revalidatePath(`/base-produtos/${record.documentId}`);
  return { success: true };
}

// Campos obrigatórios para publicar (§8.5): PENDENTE (value null) bloqueia. first12 é opcional.
const REQUIRED_FIELDS: readonly ExtractedFieldKey[] = [
  "productName",
  "productCode",
  "creditAmount",
  "termMonths",
  "totalAdministrationFeePercent",
  "regularInstallmentAmount",
];

const FIELD_LABEL: Record<ExtractedFieldKey, string> = {
  productName: "Produto",
  productCode: "Código",
  creditAmount: "Valor da carta",
  termMonths: "Prazo",
  totalAdministrationFeePercent: "Taxa adm",
  regularInstallmentAmount: "Parcela mensal",
  first12InstallmentAmount: "Parcela 1ª–12ª",
};

/** Valida obrigatórios (§8.5) e faixas (§8.9). Retorna mensagem de erro clara ou null. */
function validateForPublish(record: ExtractedProductRecord): string | null {
  const pending = REQUIRED_FIELDS.filter((f) => record[f].value === null);
  if (pending.length > 0) {
    return `Campo pendente bloqueia a publicação: ${pending.map((f) => FIELD_LABEL[f]).join(", ")}. Preencha antes de publicar.`;
  }

  const credit = new Decimal(record.creditAmount.value!);
  if (credit.lte(0)) return "Valor da carta deve ser maior que zero.";

  const term = Number(record.termMonths.value);
  if (!Number.isInteger(term) || term < 1 || term > 600) return "Prazo fora do intervalo permitido (1–600 meses).";

  const fee = new Decimal(record.totalAdministrationFeePercent.value!);
  if (fee.lt(0) || fee.gt(100)) return "Taxa de administração fora do intervalo permitido (0–100%).";

  const regular = new Decimal(record.regularInstallmentAmount.value!);
  if (regular.lte(0)) return "Parcela mensal deve ser maior que zero.";
  if (regular.gte(credit)) return "Parcela mensal deve ser menor que o valor da carta.";

  if (record.first12InstallmentAmount.value !== null) {
    const first12 = new Decimal(record.first12InstallmentAmount.value);
    if (first12.lte(0)) return "Parcela 1ª–12ª deve ser maior que zero.";
    if (first12.gte(credit)) return "Parcela 1ª–12ª deve ser menor que o valor da carta.";
  }
  return null;
}

export type PublishState = { error?: string; published?: number; productId?: string };

type PublishOptions = {
  category: Product["category"];
  administratorName: string;
  correctionIndex: Product["correctionIndex"];
};

type PublishOneOptions = { requireApproved?: boolean };

/**
 * Publica UM candidato em consortium_products.
 * No fluxo manual exige review_status='approved'; no fluxo automático publica apenas
 * candidatos completos validados pelo parser.
 */
async function publishOne(
  record: ExtractedProductRecord,
  opts: PublishOptions,
  options: PublishOneOptions = { requireApproved: true },
): Promise<string> {
  if (record.reviewStatus === "published") throw new Error("Produto já publicado");
  if (options.requireApproved !== false && record.reviewStatus !== "approved") {
    throw new Error("Aprove o produto antes de publicar");
  }

  const validationError = validateForPublish(record);
  if (validationError) throw new Error(validationError);

  const input: PublishProductInput = {
    productName: record.productName.value!,
    productCode: record.productCode.value!,
    administratorName: opts.administratorName.trim() || "—",
    category: opts.category,
    creditAmount: record.creditAmount.value!,
    termMonths: Number(record.termMonths.value),
    totalAdministrationFeePercent: record.totalAdministrationFeePercent.value!,
    regularInstallmentAmount: record.regularInstallmentAmount.value!,
    first12InstallmentAmount: record.first12InstallmentAmount.value,
    correctionIndex: opts.correctionIndex,
    sourceDocumentId: record.documentId,
    sourcePage: record.page,
    extractionConfidence: record.overallConfidence,
  };

  const existing = await findDuplicateProduct(input.productCode, input.category, input.termMonths, input.creditAmount);

  let productId: string;
  if (existing) {
    await updatePublishedProduct(existing.id, input);
    productId = existing.id;
    // Versionamento: previous/new state no audit são o histórico de versões do produto.
    await logAudit({
      action: "product.publish_from_pdf",
      entityType: "consortium_products",
      entityId: productId,
      previousState: existing,
      newState: input,
    });
  } else {
    productId = await insertPublishedProduct(input);
    await logAudit({
      action: "product.publish_from_pdf",
      entityType: "consortium_products",
      entityId: productId,
      newState: input,
    });
  }

  await setReviewStatus(record.id, "published", productId);
  return productId;
}

function isAutoPublishComplete(record: ExtractedProductRecord): boolean {
  const required: ExtractedFieldKey[] = [
    "productName",
    "productCode",
    "creditAmount",
    "termMonths",
    "totalAdministrationFeePercent",
    "first12InstallmentAmount",
    "regularInstallmentAmount",
  ];
  return required.every((field) => record[field].value !== null)
    && /^[A-Za-z]+[A-Za-z0-9-]*\d+/.test(record.productCode.value ?? "");
}

function inferCategory(record: ExtractedProductRecord): Product["category"] {
  const text = `${record.productName.value ?? ""} ${record.productCode.value ?? ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\b(auto|automovel|veiculo|carro|moto)\b/.test(text)) return "vehicle";
  if (/\b(imovel|imobiliario|residencial)\b/.test(text) || /^ie/i.test(record.productCode.value ?? "")) return "property";
  return "other";
}

function inferCorrectionIndex(category: Product["category"]): Product["correctionIndex"] {
  return category === "property" ? "INCC" : "NONE";
}

async function autoPublishDocumentProducts(
  documentId: string,
  defaults: Partial<Pick<PublishOptions, "administratorName" | "correctionIndex">> = {},
): Promise<{ published: number; pending: number }> {
  const records = await listByDocument(documentId);
  let published = 0;

  for (const record of records) {
    if (record.reviewStatus !== "pending_review" || !isAutoPublishComplete(record)) continue;
    const category = inferCategory(record);
    try {
      await publishOne(record, {
        category,
        administratorName: defaults.administratorName?.trim() || "Upload PDF",
        correctionIndex: defaults.correctionIndex ?? inferCorrectionIndex(category),
      }, { requireApproved: false });
      published++;
    } catch {
      // Produtos incompletos ou inválidos permanecem em revisão.
    }
  }

  const pending = await countExtractedProducts(documentId, "pending_review");
  if (published > 0 && pending === 0) await updateDocumentStatus(documentId, "completed", undefined, true);

  return { published, pending };
}

const publishOptionsSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  administratorName: z.string().max(200),
  correctionIndex: z.enum(CORRECTION_VALUES),
});

const approveAndPublishSchema = publishOptionsSchema.extend({ id: z.string().uuid() });

/** Publica um único candidato aprovado (clique individual por produto). */
export async function approveAndPublishAction(input: {
  id: string;
  category: Product["category"];
  administratorName: string;
  correctionIndex: Product["correctionIndex"];
}): Promise<PublishState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };

  const parsed = approveAndPublishSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Entrada inválida" };

  const record = await getExtractedProduct(parsed.data.id);
  if (!record) return { error: "Produto extraído não encontrado" };

  try {
    const productId = await publishOne(record, parsed.data);
    revalidatePath(`/base-produtos/${record.documentId}`);
    revalidatePath("/base-produtos");
    revalidatePath("/produtos");
    return { published: 1, productId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao publicar" };
  }
}

const publishApprovedSchema = z.object({
  documentId: z.string().uuid(),
  administratorName: z.string().max(200),
  correctionIndex: z.enum(CORRECTION_VALUES),
  items: z.array(z.object({ id: z.string().uuid(), category: z.enum(CATEGORY_VALUES) })).min(1),
});

/**
 * Publica em lote os candidatos JÁ APROVADOS individualmente (exige aprovação prévia).
 * Cada item só é publicado se seu review_status atual for 'approved'.
 */
export async function publishApprovedAction(input: {
  documentId: string;
  administratorName: string;
  correctionIndex: Product["correctionIndex"];
  items: { id: string; category: Product["category"] }[];
}): Promise<PublishState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };

  const parsed = publishApprovedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Entrada inválida" };

  let published = 0;
  const errors: string[] = [];
  for (const item of parsed.data.items) {
    const record = await getExtractedProduct(item.id);
    if (!record || record.reviewStatus !== "approved") continue;
    try {
      await publishOne(record, {
        category: item.category,
        administratorName: parsed.data.administratorName,
        correctionIndex: parsed.data.correctionIndex,
      });
      published++;
    } catch (error) {
      errors.push(`Página ${record.page}: ${error instanceof Error ? error.message : "falha"}`);
    }
  }

  revalidatePath(`/base-produtos/${parsed.data.documentId}`);
  revalidatePath("/base-produtos");
  revalidatePath("/produtos");

  if (published === 0) return { error: errors[0] ?? "Nenhum produto aprovado para publicar." };
  return { published, error: errors.length > 0 ? errors.join(" | ") : undefined };
}

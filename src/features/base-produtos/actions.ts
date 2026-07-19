"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";
import { findDocumentByHash, insertDocument } from "@/repositories/documents";
import { logAudit } from "@/repositories/audit";
import { hasPdfMagicBytes, sanitizeFileName, sha256Hex } from "@/lib/pdf/upload-validation";
import { processDocument } from "@/services/pdf-pipeline";
import type { ColumnMapping } from "@/lib/pdf/parse-products";
import { maxPdfSizeBytes } from "./schema";

const BUCKET = "product-documents";

export type UploadDocumentState = {
  error?: string;
  documentId?: string;
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

  revalidatePath("/base-produtos");
  return { documentId };
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
  status?: "review_required" | "failed";
};

/**
 * Dispara o pipeline de extração de um documento já enviado (Task 4). Staff apenas.
 * NUNCA publica produtos: só gera a staging `extracted_products` para revisão humana.
 */
export async function processDocumentAction(input: ProcessDocumentInput): Promise<ProcessDocumentState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };

  const parsed = processDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Entrada inválida" };

  const { documentId, manualMapping } = parsed.data;

  try {
    const result = await processDocument(documentId, manualMapping as ColumnMapping | undefined);
    await logAudit({
      action: "document.process",
      entityType: "product_documents",
      entityId: documentId,
      newState: { productsFound: result.productsFound },
    });
    revalidatePath("/base-produtos");
    return { productsFound: result.productsFound, status: result.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar o documento";
    return { error: message };
  }
}

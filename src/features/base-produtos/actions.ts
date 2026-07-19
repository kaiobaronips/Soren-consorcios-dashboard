"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";
import { findDocumentByHash, insertDocument } from "@/repositories/documents";
import { logAudit } from "@/repositories/audit";
import { hasPdfMagicBytes, sanitizeFileName, sha256Hex } from "@/lib/pdf/upload-validation";
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

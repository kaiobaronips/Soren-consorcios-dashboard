import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";

const BUCKET = "product-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 min: suficiente para abrir o PDF na revisão.

export type DocumentStatus = "uploaded" | "processing" | "review_required" | "completed" | "failed";

export type ProductDocument = {
  id: string;
  fileName: string;
  storagePath: string;
  status: DocumentStatus;
  extractionLog: string[];
  uploadedBy: string;
  createdAt: string;
  processedAt: string | null;
  fileHash: string;
};

type Row = {
  id: string;
  file_name: string;
  storage_path: string;
  status: DocumentStatus;
  extraction_log: string[];
  uploaded_by: string;
  created_at: string;
  processed_at: string | null;
  file_hash: string;
};

const COLUMNS = "id, file_name, storage_path, status, extraction_log, uploaded_by, created_at, processed_at, file_hash";

function toDocument(r: Row): ProductDocument {
  return {
    id: r.id,
    fileName: r.file_name,
    storagePath: r.storage_path,
    status: r.status,
    extractionLog: Array.isArray(r.extraction_log) ? r.extraction_log : [],
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
    processedAt: r.processed_at,
    fileHash: r.file_hash,
  };
}

/** Lista documentos da organização (RLS: product_documents_staff restringe a staff da org). */
export async function listDocuments(): Promise<ProductDocument[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("product_documents")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toDocument);
}

export async function getDocument(id: string): Promise<ProductDocument | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("product_documents").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toDocument(data as Row) : null;
}

/** Busca por hash para deduplicação (RLS já limita à org do usuário). */
export async function findDocumentByHash(hash: string): Promise<ProductDocument | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("product_documents")
    .select(COLUMNS)
    .eq("file_hash", hash)
    .maybeSingle();
  if (error) throw error;
  return data ? toDocument(data as Row) : null;
}

export type NewDocument = {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileHash: string;
};

/** Insere o registro do documento (status inicial `uploaded`). Retorna o id. */
export async function insertDocument(d: NewDocument): Promise<string> {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("product_documents")
    .insert({
      organization_id: profile.organizationId,
      file_name: d.fileName,
      storage_path: d.storagePath,
      mime_type: d.mimeType,
      file_hash: d.fileHash,
      status: "uploaded",
      uploaded_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Atualiza status e, opcionalmente, o log de extração e o carimbo de processamento. */
export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  log?: string[],
  processedAt?: boolean,
): Promise<void> {
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = { status };
  if (log !== undefined) patch.extraction_log = log;
  if (processedAt) patch.processed_at = new Date().toISOString();
  const { error } = await supabase.from("product_documents").update(patch).eq("id", id);
  if (error) throw error;
}

/** URL assinada temporária para visualizar o PDF privado na tela de revisão. */
export async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

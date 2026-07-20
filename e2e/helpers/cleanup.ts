import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * Apaga, via service role, todos os registros de teste E2E identificados pelo
 * prefixo "[E2E]" no nome. Usado em afterEach/afterAll para não poluir o banco
 * local entre execuções. Nunca usar em produção — exige SUPABASE_SERVICE_ROLE_KEY.
 */
export async function cleanupE2EData(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local) para limpar dados de E2E",
    );
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // simulations não tem coluna "name" própria — apaga pelas simulações dos clientes de teste.
  const { data: testClients, error: findError } = await admin
    .from("clients")
    .select("id")
    .ilike("name", "[E2E]%");
  if (findError) throw findError;

  const clientIds = (testClients ?? []).map((c: { id: string }) => c.id);
  if (clientIds.length > 0) {
    const { error: simError } = await admin.from("simulations").delete().in("client_id", clientIds);
    if (simError) throw simError;
  }

  const { error: clientError } = await admin.from("clients").delete().ilike("name", "[E2E]%");
  if (clientError) throw clientError;
}

const BASE_PRODUTOS_BUCKET = "product-documents";

/**
 * Apaga, via service role, todo o rastro dos testes E2E da Base de Produtos
 * identificados pelo nome de arquivo do fixture: documento(s) em
 * `product_documents`, candidatos em `extracted_products`, produtos publicados
 * em `consortium_products` (via `source_document_id`) e o objeto correspondente
 * no Storage (bucket `product-documents`). Chamar em beforeEach (garante slate
 * limpo antes do teste de dedup) e afterEach (não deixa rastro entre execuções).
 */
export async function cleanupBaseProdutosE2EData(fileName = "tabela-simples.pdf"): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local) para limpar dados de E2E",
    );
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: docs, error: findError } = await admin
    .from("product_documents")
    .select("id, storage_path")
    .eq("file_name", fileName);
  if (findError) throw findError;

  const documents = (docs ?? []) as { id: string; storage_path: string }[];
  if (documents.length === 0) return;

  const docIds = documents.map((d) => d.id);

  const { error: productError } = await admin
    .from("consortium_products")
    .delete()
    .in("source_document_id", docIds);
  if (productError) throw productError;

  const { error: extractedError } = await admin
    .from("extracted_products")
    .delete()
    .in("document_id", docIds);
  if (extractedError) throw extractedError;

  const { error: documentError } = await admin.from("product_documents").delete().in("id", docIds);
  if (documentError) throw documentError;

  const paths = documents.map((d) => d.storage_path);
  const { error: storageError } = await admin.storage.from(BASE_PRODUTOS_BUCKET).remove(paths);
  // Objeto pode já não existir (upload nunca chegou a concluir); não falha o teste por isso.
  if (storageError && !/not.?found/i.test(storageError.message)) throw storageError;
}

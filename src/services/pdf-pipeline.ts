import { extractPdfText } from "@/lib/pdf/extract-text";
import { extractProductsFromText, type ColumnMapping, type ExtractedProduct } from "@/lib/pdf/parse-products";
import {
  getDocument,
  getDocumentSignedUrl,
  updateDocumentStatus,
} from "@/repositories/documents";
import { replacePendingExtractedProducts } from "@/repositories/extracted-products";

/**
 * Pipeline de processamento de um documento PDF de produtos de consórcio.
 *
 * Fluxo (processDocument):
 *   status -> processing
 *   baixa o PDF do Storage (URL assinada da sessão do usuário)
 *   extractPdfText (texto nativo + OCR de fallback) -> extractProductsFromText
 *   grava em extracted_products substituindo apenas os `pending_review` do doc
 *   status -> review_required  (ou `failed` com log legível em caso de erro/0 páginas)
 *
 * REGRA INVIOLÁVEL: este pipeline NUNCA publica em consortium_products. Publicar é
 * ação humana da Task 5. Aqui só produzimos staging para revisão.
 *
 * `processBuffer` é a metade pura (extração + parsing, sem tocar Storage/DB): existe
 * para ser exercida por teste de integração leve e é reusada por dentro de processDocument.
 */

export type ProcessBufferResult = {
  products: ExtractedProduct[];
  pageCount: number;
  log: string[];
};

/** Extração + parsing a partir do buffer bruto do PDF. Sem I/O de Storage/DB. */
export async function processBuffer(
  buffer: Buffer,
  manualMapping?: ColumnMapping,
): Promise<ProcessBufferResult> {
  const { pages, log: extractionLog } = await extractPdfText(buffer);
  const { products, log: parseLog } = extractProductsFromText(
    pages.map(({ page, lines }) => ({ page, lines })),
    manualMapping,
  );
  return {
    products,
    pageCount: pages.length,
    log: [...extractionLog, ...parseLog],
  };
}

export type ProcessDocumentResult = {
  productsFound: number;
  status: "review_required" | "failed";
  log: string[];
};

/**
 * Processa um documento já enviado ao Storage: baixa, extrai, faz parsing e grava a
 * staging para revisão humana. Acumula o log de extração no registro do documento.
 */
export async function processDocument(
  documentId: string,
  manualMapping?: ColumnMapping,
): Promise<ProcessDocumentResult> {
  const document = await getDocument(documentId);
  if (!document) throw new Error("Documento não encontrado");

  const log: string[] = [...document.extractionLog];
  const stamp = (msg: string) => log.push(`[${new Date().toISOString()}] ${msg}`);

  stamp("processamento iniciado");
  await updateDocumentStatus(documentId, "processing", log);

  try {
    const signedUrl = await getDocumentSignedUrl(document.storagePath);
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`falha ao baixar o PDF do Storage (HTTP ${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    const { products, pageCount, log: pipelineLog } = await processBuffer(buffer, manualMapping);
    for (const entry of pipelineLog) stamp(entry);

    if (pageCount === 0) {
      stamp("nenhuma página legível no PDF — marcado como falha");
      await updateDocumentStatus(documentId, "failed", log, true);
      return { productsFound: 0, status: "failed", log };
    }

    const written = await replacePendingExtractedProducts(documentId, products);
    stamp(`${written} produto(s) gravado(s) na staging para revisão`);

    await updateDocumentStatus(documentId, "review_required", log, true);
    return { productsFound: written, status: "review_required", log };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stamp(`erro no processamento: ${message}`);
    await updateDocumentStatus(documentId, "failed", log, true);
    return { productsFound: 0, status: "failed", log };
  }
}

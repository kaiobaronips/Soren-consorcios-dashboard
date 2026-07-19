import { createHash } from "node:crypto";

/** Assinatura de arquivos PDF: todo PDF válido começa com estes 5 bytes. */
export const PDF_MAGIC = "%PDF-";

/** Valida os magic bytes reais do conteúdo — não confia no MIME informado pelo browser. */
export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return new TextDecoder("latin1").decode(bytes.subarray(0, PDF_MAGIC.length)) === PDF_MAGIC;
}

/** Remove qualquer caractere fora de [a-zA-Z0-9._-] para um nome seguro no storage. */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "documento.pdf";
}

/** SHA-256 hexadecimal do conteúdo — usado para deduplicação. */
export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

import { z } from "zod";

export const documentStatusSchema = z.enum([
  "uploaded",
  "processing",
  "review_required",
  "completed",
  "failed",
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

const DEFAULT_MAX_PDF_SIZE_MB = 20;

/** Limite de upload em bytes, a partir de MAX_PDF_SIZE_MB (fallback 20 MB). */
export function maxPdfSizeBytes(): number {
  const mb = Number(process.env.MAX_PDF_SIZE_MB ?? DEFAULT_MAX_PDF_SIZE_MB);
  const effective = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_PDF_SIZE_MB;
  return effective * 1024 * 1024;
}

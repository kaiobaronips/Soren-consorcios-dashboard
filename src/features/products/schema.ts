import { z } from "zod";

export const toggleStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

/** Cadastro manual (staff). Valores monetários chegam como string "1234.56"; percentuais em pontos. */
export const createProductSchema = z.object({
  productName: z.string().min(3, "Nome muito curto"),
  productCode: z.string().min(2, "Código muito curto"),
  administratorName: z.string().min(2, "Informe a administradora"),
  category: z.enum(["property", "vehicle", "other"]),
  creditAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (use 1234.56)"),
  termMonths: z.coerce.number().int().positive("Prazo deve ser positivo"),
  totalAdministrationFeePercent: z.string().regex(/^\d+(\.\d{1,3})?$/, "Taxa inválida (pontos percentuais)"),
  regularInstallmentAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido"),
  first12InstallmentAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido").optional().or(z.literal("")),
  correctionIndex: z.enum(["IGPM", "IPCA", "INCC", "NONE", "CUSTOM"]),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

import { z } from "zod";

/** Cadastro de cliente (consultor). monthlyIncome e monthlyAvailableAmount são campos distintos — nunca sinônimos. */
export const createClientSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  monthlyIncome: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (use 1234.56)").optional().or(z.literal("")),
  monthlyAvailableAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (use 1234.56)").optional().or(z.literal("")),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

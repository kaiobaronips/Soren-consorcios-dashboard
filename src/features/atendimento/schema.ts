import { z } from "zod";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (use 1234.56)");

/**
 * Formulário de atendimento. clientId presente => atualiza cliente existente;
 * ausente => cria cliente novo (exige clientName).
 */
export const atenderSchema = z
  .object({
    clientId: z.string().uuid().optional().or(z.literal("")),
    clientName: z.string().optional().or(z.literal("")),
    monthlyIncome: decimalString.optional().or(z.literal("")),
    monthlyAvailableAmount: decimalString.refine(
      (v) => Number(v) > 0,
      "Disponível deve ser maior que zero",
    ),
    desiredCategory: z.enum(["all", "property", "vehicle", "other"]),
    desiredTermMonths: z
      .string()
      .regex(/^[1-9]\d*$/, "Prazo inválido")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (!data.clientId && (data.clientName ?? "").trim().length < 2) {
      ctx.addIssue({ code: "custom", path: ["clientName"], message: "Nome muito curto" });
    }
  });

export type AtenderInput = z.infer<typeof atenderSchema>;

import { z } from "zod";

function normalizeMoneyInput(value: string, ctx: z.RefinementCtx): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    ctx.addIssue({ code: "custom", message: "Valor inválido (use 1.500,00)" });
    return z.NEVER;
  }
  return normalized;
}

const moneyInput = z.string().transform(normalizeMoneyInput);

/**
 * Formulário de atendimento. clientId presente => atualiza cliente existente;
 * ausente => cria cliente novo (exige clientName).
 */
export const atenderSchema = z
  .object({
    clientId: z.string().uuid().optional().or(z.literal("")),
    clientName: z.string().optional().or(z.literal("")),
    monthlyIncome: moneyInput.optional().or(z.literal("")),
    monthlyAvailableAmount: moneyInput.refine(
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
    if (!data.clientId) {
      ctx.addIssue({ code: "custom", path: ["clientName"], message: "Selecione um cliente cadastrado" });
    }
  });

export type AtenderInput = z.infer<typeof atenderSchema>;

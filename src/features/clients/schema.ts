import { z } from "zod";

function normalizeMoneyInput(value: string, ctx: z.RefinementCtx): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    ctx.addIssue({ code: "custom", message: "Valor inválido (use 3.000,00)" });
    return z.NEVER;
  }
  return normalized;
}

const moneyInput = z.string().transform(normalizeMoneyInput);

function formatPersonName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase("pt-BR")}`);
}

/** Cadastro de cliente (consultor). monthlyIncome e monthlyAvailableAmount são campos distintos — nunca sinônimos. */
export const createClientSchema = z.object({
  name: z.string().min(3, "Nome muito curto").transform(formatPersonName),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  monthlyIncome: moneyInput.optional(),
  monthlyAvailableAmount: moneyInput.optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.extend({
  id: z.string().uuid("Cliente inválido"),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

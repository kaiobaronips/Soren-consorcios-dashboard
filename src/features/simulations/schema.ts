import { z } from "zod";

/**
 * Salva uma simulação. As premissas (assumptions) chegam já resolvidas pela UI
 * (cenário aplicado sobre a taxa base — ver resolveScenarioRate). O produto NÃO é
 * reenviado por inteiro: a action busca o produto atual por productId e captura o
 * snapshot no momento do save (garante imutabilidade — casos 19 e 20).
 */
export const saveSimulationSchema = z.object({
  clientId: z.string().uuid(),
  productId: z.string().uuid(),
  selectedMonth: z.coerce.number().int().positive("Mês selecionado deve ser positivo"),
  scenario: z.enum(["conservative", "base", "aggressive", "custom"]),
  indexCode: z.enum(["IGPM", "IPCA", "INCC", "NONE", "CUSTOM"]),
  annualRatePercent: z.string().regex(/^-?\d+(\.\d{1,4})?$/, "Taxa inválida"),
  rateOrigin: z.string().min(1, "Informe a origem da taxa"),
  rateUpdatedAt: z.string().min(1, "Informe a data de atualização da taxa"),
  rateType: z.enum(["projected", "historical", "manual"]),
  adjustmentFrequencyMonths: z.coerce.number().int().positive("Frequência deve ser positiva"),
  monthlyAvailableAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (use 1234.56)"),
  monthlyIncome: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (use 1234.56)").optional().or(z.literal("")),
});
export type SaveSimulationInput = z.infer<typeof saveSimulationSchema>;

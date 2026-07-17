"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/repositories/profiles";
import { getClient } from "@/repositories/clients";
import { getProduct } from "@/repositories/products";
import { saveSimulation, toProductSnapshot, type SimulationSnapshotInput } from "@/repositories/simulations";
import { logAudit } from "@/repositories/audit";
import { saveSimulationSchema } from "./schema";

export type SaveSimulationState = { error?: string; simulationId?: string };

export async function saveSimulationAction(
  _prev: SaveSimulationState | undefined,
  formData: FormData,
): Promise<SaveSimulationState> {
  await getCurrentProfile();
  const parsed = saveSimulationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const client = await getClient(d.clientId);
  if (!client) return { error: "Cliente não encontrado" };
  const product = await getProduct(d.productId);
  if (!product) return { error: "Produto não encontrado" };

  const input: SimulationSnapshotInput = {
    product: toProductSnapshot(product),
    assumptions: {
      scenario: d.scenario,
      indexCode: d.indexCode,
      annualRatePercent: d.annualRatePercent,
      rateOrigin: d.rateOrigin,
      rateUpdatedAt: d.rateUpdatedAt,
      rateType: d.rateType,
      adjustmentFrequencyMonths: d.adjustmentFrequencyMonths,
    },
    selectedMonth: d.selectedMonth,
  };

  const simulationId = await saveSimulation({
    clientId: d.clientId,
    productId: d.productId,
    input,
    monthlyAvailableAmount: d.monthlyAvailableAmount,
    monthlyIncome: d.monthlyIncome || null,
  });

  await logAudit({
    action: "simulation.create",
    entityType: "simulations",
    entityId: simulationId,
    newState: { clientId: d.clientId, productId: d.productId, selectedMonth: d.selectedMonth, assumptions: input.assumptions },
  });
  revalidatePath("/clientes");
  return { simulationId };
}

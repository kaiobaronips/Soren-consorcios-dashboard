"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/repositories/profiles";
import { getClient, insertClient, updateClientFinancials } from "@/repositories/clients";
import { listProducts } from "@/repositories/products";
import { logAudit } from "@/repositories/audit";
import { basisInstallment } from "@/domain/eligibility";
import { getOrgSettings } from "@/repositories/settings";
import { runAtendimento, type AtendimentoResult } from "@/services/atendimento";
import { atenderSchema } from "./schema";

export type AtenderClient = {
  id: string;
  name: string;
  monthlyIncome: string | null;
  monthlyAvailableAmount: string;
};

export type AtenderState = {
  error?: string;
  result?: AtendimentoResult;
  client?: AtenderClient;
  /** Menor parcela do catálogo (ignorando elegibilidade) — dica para o estado vazio. */
  catalogMinInstallment?: string | null;
};

/** Menor parcela do catálogo ativo (na categoria filtrada), usada como dica no estado vazio. */
async function catalogMinInstallment(
  desiredCategory: "all" | "property" | "vehicle" | "other",
): Promise<string | null> {
  const [products, settings] = await Promise.all([
    listProducts({ status: "active", ...(desiredCategory === "all" ? {} : { category: desiredCategory }) }),
    getOrgSettings(),
  ]);
  if (products.length === 0) return null;
  let min: Decimal | null = null;
  for (const p of products) {
    const installment = new Decimal(basisInstallment(p, settings.eligibilityBasis));
    if (!min || installment.lt(min)) min = installment;
  }
  return min ? min.toFixed(2) : null;
}

/**
 * Orquestra o atendimento: cria ou atualiza os dados financeiros do cliente e roda a
 * elegibilidade/ranking (runAtendimento). Cliente existente => updateClientFinancials
 * com auditoria (previous/new state); cliente novo => insertClient.
 */
export async function atender(_prev: AtenderState | undefined, formData: FormData): Promise<AtenderState> {
  await getCurrentProfile();
  const parsed = atenderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const monthlyIncome = d.monthlyIncome || null;
  const monthlyAvailableAmount = d.monthlyAvailableAmount;
  const desiredTermMonths = d.desiredTermMonths ? Number(d.desiredTermMonths) : null;

  let clientId = d.clientId || "";
  let clientName = (d.clientName || "").trim();

  if (clientId) {
    const before = await getClient(clientId);
    if (!before) return { error: "Cliente não encontrado" };
    await updateClientFinancials(clientId, monthlyIncome, monthlyAvailableAmount);
    await logAudit({
      action: "client.update_financials",
      entityType: "clients",
      entityId: clientId,
      previousState: {
        monthlyIncome: before.monthlyIncome,
        monthlyAvailableAmount: before.monthlyAvailableAmount,
      },
      newState: { monthlyIncome, monthlyAvailableAmount },
    });
    clientName = before.name;
  } else {
    clientId = await insertClient({ name: clientName, monthlyIncome, monthlyAvailableAmount });
    await logAudit({
      action: "client.create",
      entityType: "clients",
      entityId: clientId,
      newState: { name: clientName, monthlyIncome, monthlyAvailableAmount },
    });
  }

  const result = await runAtendimento({
    monthlyAvailableAmount,
    monthlyIncome,
    desiredCategory: d.desiredCategory,
    desiredTermMonths,
  });

  revalidatePath("/clientes");

  const hint = result.summary.eligibleCount === 0 ? await catalogMinInstallment(d.desiredCategory) : null;

  return {
    result,
    client: { id: clientId, name: clientName, monthlyIncome, monthlyAvailableAmount },
    catalogMinInstallment: hint,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/repositories/profiles";
import { insertClient, searchClients, type Client } from "@/repositories/clients";
import { logAudit } from "@/repositories/audit";
import { createClientSchema } from "./schema";

export type CreateClientState = { error?: string; clientId?: string };

export async function createClientAction(
  _prev: CreateClientState | undefined,
  formData: FormData,
): Promise<CreateClientState> {
  await getCurrentProfile();
  const parsed = createClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const clientId = await insertClient({
    name: d.name,
    email: d.email || null,
    phone: d.phone || null,
    monthlyIncome: d.monthlyIncome || null,
    monthlyAvailableAmount: d.monthlyAvailableAmount || null,
  });
  await logAudit({ action: "client.create", entityType: "clients", entityId: clientId, newState: parsed.data });
  revalidatePath("/clientes");
  return { clientId };
}

/** Usado pela busca incremental na UI (server action chamada a partir de client component). */
export async function searchClientsAction(term: string): Promise<Client[]> {
  await getCurrentProfile();
  return searchClients(term);
}

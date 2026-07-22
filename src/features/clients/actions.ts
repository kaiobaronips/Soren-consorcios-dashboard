"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/repositories/profiles";
import { deleteClient, getClient, insertClient, searchClients, updateClient, type Client } from "@/repositories/clients";
import { logAudit } from "@/repositories/audit";
import { createClientSchema, updateClientSchema } from "./schema";

export type CreateClientState = { error?: string; clientId?: string };
export type UpdateClientState = { error?: string; success?: boolean };
export type DeleteClientState = { error?: string; success?: boolean };

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

export async function updateClientAction(
  _prev: UpdateClientState | undefined,
  formData: FormData,
): Promise<UpdateClientState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") return { error: "Sem permissão" };

  const parsed = updateClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const before = await getClient(parsed.data.id);
  if (!before) return { error: "Cliente não encontrado" };

  await updateClient(parsed.data.id, {
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    monthlyIncome: parsed.data.monthlyIncome || null,
    monthlyAvailableAmount: parsed.data.monthlyAvailableAmount || null,
  });
  await logAudit({
    action: "client.update",
    entityType: "clients",
    entityId: parsed.data.id,
    previousState: before,
    newState: parsed.data,
  });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${parsed.data.id}`);
  return { success: true };
}

export async function deleteClientAction(
  _prev: DeleteClientState | undefined,
  formData: FormData,
): Promise<DeleteClientState> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") return { error: "Sem permissão" };

  const id = String(formData.get("id") ?? "");
  const before = await getClient(id);
  if (!before) return { error: "Cliente não encontrado" };

  await deleteClient(id);
  await logAudit({
    action: "client.delete",
    entityType: "clients",
    entityId: id,
    previousState: before,
  });
  revalidatePath("/clientes");
  return { success: true };
}

/** Usado pela busca incremental na UI (server action chamada a partir de client component). */
export async function searchClientsAction(term: string): Promise<Client[]> {
  await getCurrentProfile();
  return searchClients(term);
}

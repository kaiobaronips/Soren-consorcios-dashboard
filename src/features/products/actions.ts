"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/repositories/profiles";
import { getProduct, insertProduct, setProductStatus } from "@/repositories/products";
import { logAudit } from "@/repositories/audit";
import { createProductSchema, toggleStatusSchema } from "./schema";

export async function toggleProductStatus(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") throw new Error("Sem permissão");
  const { id, status } = toggleStatusSchema.parse(Object.fromEntries(formData));
  const before = await getProduct(id);
  if (!before) throw new Error("Produto não encontrado");
  await setProductStatus(id, status);
  await logAudit({
    action: "product.status_change",
    entityType: "consortium_products",
    entityId: id,
    previousState: { status: before.status },
    newState: { status },
  });
  revalidatePath("/produtos");
}

export type CreateProductState = { error?: string; success?: boolean };

export async function createProduct(_prev: CreateProductState | undefined, formData: FormData): Promise<CreateProductState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };
  const parsed = createProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const id = await insertProduct({
    productName: d.productName, productCode: d.productCode,
    administratorName: d.administratorName, category: d.category,
    creditAmount: d.creditAmount, termMonths: d.termMonths,
    totalAdministrationFeePercent: d.totalAdministrationFeePercent,
    regularInstallmentAmount: d.regularInstallmentAmount,
    first12InstallmentAmount: d.first12InstallmentAmount || null,
    correctionIndex: d.correctionIndex,
  });
  await logAudit({ action: "product.create", entityType: "consortium_products", entityId: id, newState: parsed.data });
  revalidatePath("/produtos");
  return { success: true };
}

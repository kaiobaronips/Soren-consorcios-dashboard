import type { ParsedProduct } from "./parse-consorcio";

export type ExistingProduct = ParsedProduct & { id: string };

export type ImportPlan = {
  toInsert: ParsedProduct[];
  toUpdate: { id: string; data: ParsedProduct }[];
  unchanged: ParsedProduct[];
};

/** Chave de dedup: productCode + termMonths + creditAmount (categoria fixa 'property' na importação). */
export function dedupKey(p: Pick<ParsedProduct, "productCode" | "termMonths" | "creditAmount">): string {
  return `${p.productCode}|${p.termMonths}|${p.creditAmount}`;
}

const COMPARED_FIELDS = [
  "productName", "totalAdministrationFeePercent",
  "first12InstallmentAmount", "regularInstallmentAmount",
] as const;

export function planImport(parsed: ParsedProduct[], existing: ExistingProduct[]): ImportPlan {
  const byKey = new Map(existing.map((e) => [dedupKey(e), e]));
  const plan: ImportPlan = { toInsert: [], toUpdate: [], unchanged: [] };
  for (const p of parsed) {
    const found = byKey.get(dedupKey(p));
    if (!found) {
      plan.toInsert.push(p);
    } else if (COMPARED_FIELDS.some((f) => p[f] !== found[f])) {
      plan.toUpdate.push({ id: found.id, data: p });
    } else {
      plan.unchanged.push(p);
    }
  }
  return plan;
}

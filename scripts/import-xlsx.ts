import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import Decimal from "decimal.js";
import { parseConsorcioXlsx } from "../src/lib/xlsx/parse-consorcio";
import { planImport, type ExistingProduct } from "../src/lib/xlsx/import-plan";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const FIXED = {
  category: "property",
  administrator_name: "Não informada (planilha)",
  correction_index: "IGPM",
  correction_frequency_months: 12,
  reserve_fund_percent: "2.000",
  status: "active",
  is_demo: false,
} as const;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Uso: pnpm import:xlsx <arquivo.xlsx>");

  const { data: org, error: orgErr } = await admin
    .from("organizations").select("id").eq("name", "Soren Consórcios").single();
  if (orgErr || !org) throw new Error("Organização demo não encontrada — rode pnpm db:seed antes.");

  const { products, invalidRows } = await parseConsorcioXlsx(filePath);

  const { data: existingRows, error: exErr } = await admin
    .from("consortium_products")
    .select("id, product_name, product_code, credit_amount, term_months, total_administration_fee_percent, first_12_installment_amount, regular_installment_amount")
    .eq("organization_id", org.id)
    .eq("category", "property")
    .eq("is_demo", false);
  if (exErr) throw exErr;

  // PostgREST serializa colunas NUMERIC como number JSON (perde zeros à direita),
  // então reconstruímos a string no formato exato da coluna (mesma escala do parser)
  // antes de comparar — sem isso, dedupKey/comparação de campos nunca bate.
  const existing: ExistingProduct[] = (existingRows ?? []).map((r) => ({
    id: r.id,
    productName: r.product_name,
    productCode: r.product_code,
    creditAmount: new Decimal(r.credit_amount).toFixed(2),
    termMonths: r.term_months,
    totalAdministrationFeePercent: new Decimal(r.total_administration_fee_percent).toFixed(3),
    first12InstallmentAmount: new Decimal(r.first_12_installment_amount).toFixed(2),
    regularInstallmentAmount: new Decimal(r.regular_installment_amount).toFixed(2),
  }));

  const plan = planImport(products, existing);
  const errors: string[] = [];

  for (const p of plan.toInsert) {
    const { error } = await admin.from("consortium_products").insert({
      organization_id: org.id,
      product_name: p.productName,
      product_code: p.productCode,
      credit_amount: p.creditAmount,
      term_months: p.termMonths,
      total_administration_fee_percent: p.totalAdministrationFeePercent,
      first_12_installment_amount: p.first12InstallmentAmount,
      regular_installment_amount: p.regularInstallmentAmount,
      ...FIXED,
    });
    if (error) errors.push(`INSERT ${p.productName}: ${error.message}`);
  }
  for (const u of plan.toUpdate) {
    const { error } = await admin.from("consortium_products").update({
      product_name: u.data.productName,
      total_administration_fee_percent: u.data.totalAdministrationFeePercent,
      first_12_installment_amount: u.data.first12InstallmentAmount,
      regular_installment_amount: u.data.regularInstallmentAmount,
    }).eq("id", u.id);
    if (error) errors.push(`UPDATE ${u.data.productName}: ${error.message}`);
  }

  console.log("=== Relatório de importação ===");
  console.log(`Arquivo: ${filePath}`);
  console.log(`Inseridos:  ${plan.toInsert.length - errors.filter((e) => e.startsWith("INSERT")).length}`);
  console.log(`Atualizados: ${plan.toUpdate.length - errors.filter((e) => e.startsWith("UPDATE")).length}`);
  console.log(`Ignorados (sem mudança): ${plan.unchanged.length}`);
  console.log(`Linhas inválidas: ${invalidRows.length}`);
  invalidRows.forEach((r) => console.log(`  - linha ${r.rowNumber}: ${r.reason}`));
  console.log(`Erros: ${errors.length}`);
  errors.forEach((e) => console.log(`  - ${e}`));
  if (errors.length > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

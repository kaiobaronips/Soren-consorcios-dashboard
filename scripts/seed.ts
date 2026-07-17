import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import Decimal from "decimal.js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const USERS = [
  { email: "admin@demo.soren.com.br", name: "Admin Demo", role: "admin" },
  { email: "gestor@demo.soren.com.br", name: "Gestor Demo", role: "manager" },
  { email: "ana@demo.soren.com.br", name: "Ana Consultora", role: "consultant" },
  { email: "bruno@demo.soren.com.br", name: "Bruno Consultor", role: "consultant" },
] as const;

const SETTINGS: Record<string, unknown> = {
  eligibility_rule: { basis: "regular" }, // regular | first | max
  max_income_commitment_percent: 30,
  default_adjustment_frequency_months: 12,
  projected_annual_rates: { IGPM: 6.5, IPCA: 4.5, CDI: 10.5, SAVINGS: 6.2 },
};

async function main() {
  // idempotente: reutiliza org existente pelo nome
  const { data: existingOrg } = await admin.from("organizations").select("id").eq("name", "Soren Consórcios").maybeSingle();
  const orgId: string =
    existingOrg?.id ??
    (await admin.from("organizations").insert({ name: "Soren Consórcios", document: "00.000.000/0001-00" }).select("id").single()).data!.id;

  for (const u of USERS) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: "demo12345",
      email_confirm: true,
    });
    // usuário já existe em re-execução → buscar id
    let userId = created?.user?.id;
    if (error) {
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list.users.find((x) => x.email === u.email)?.id;
      if (!userId) throw error;
    }
    const { error: profErr } = await admin.from("profiles").upsert({
      id: userId, organization_id: orgId, name: u.name, email: u.email, role: u.role, active: true,
    });
    if (profErr) throw profErr;
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    const { error: setErr } = await admin.from("system_settings").upsert(
      { organization_id: orgId, key, value },
      { onConflict: "organization_id,key" },
    );
    if (setErr) throw setErr;
  }

  const period = "2026-07-01";
  const INDEXES = [
    { index_code: "IGPM", annual_rate: 6.5 },
    { index_code: "IPCA", annual_rate: 4.5 },
    { index_code: "CDI", annual_rate: 10.5 },
    { index_code: "SAVINGS", annual_rate: 6.2 },
  ];
  for (const idx of INDEXES) {
    const { error } = await admin.from("financial_indexes").insert({
      organization_id: orgId,
      index_code: idx.index_code,
      reference_period: period,
      annual_rate: idx.annual_rate,
      monthly_rate: (((1 + idx.annual_rate / 100) ** (1 / 12) - 1) * 100).toFixed(6),
      source: "Taxa projetada configurada pelo administrador",
      projected: true,
    });
    // idempotência: unique index (index_code, reference_period, organization_id) rejeita
    // reinserções com "duplicate key" — aceitável em re-run, propaga qualquer outro erro.
    if (error && !error.message.includes("duplicate")) throw error;
  }

  const VEHICLE_DEMOS = [
    { code: "VD040", credit: "40000.00", term: 48, fee: "14.000" },
    { code: "VD050", credit: "50000.00", term: 48, fee: "14.000" },
    { code: "VD060", credit: "60000.00", term: 60, fee: "15.000" },
    { code: "VD080", credit: "80000.00", term: 60, fee: "15.000" },
    { code: "VD100", credit: "100000.00", term: 60, fee: "15.000" },
    { code: "VD120", credit: "120000.00", term: 60, fee: "16.000" },
    { code: "VD150", credit: "150000.00", term: 60, fee: "16.000" },
    { code: "VD180", credit: "180000.00", term: 60, fee: "16.000" },
  ];
  // parcela regular demo = credit × (1 + fee% + 2%) ÷ term, mesma regra da planilha,
  // calculada com decimal.js; first_12 = regular + 0.1% × credit (regra da planilha)
  for (const v of VEHICLE_DEMOS) {
    const { data: exists } = await admin.from("consortium_products").select("id")
      .eq("organization_id", orgId).eq("product_code", v.code).eq("is_demo", true).maybeSingle();
    if (exists) continue;
    const credit = new Decimal(v.credit);
    const regular = credit.times(new Decimal(1).plus(new Decimal(v.fee).div(100)).plus("0.02")).div(v.term);
    const first12 = regular.plus(credit.times("0.001"));
    const { error } = await admin.from("consortium_products").insert({
      organization_id: orgId,
      product_name: `Veículo ${v.code} – ${v.term}m (demo)`,
      product_code: v.code,
      category: "vehicle",
      administrator_name: "Demo",
      credit_amount: v.credit,
      term_months: v.term,
      total_administration_fee_percent: v.fee,
      reserve_fund_percent: "2.000",
      first_12_installment_amount: first12.toFixed(2),
      regular_installment_amount: regular.toFixed(2),
      correction_index: "IPCA",
      correction_frequency_months: 12,
      status: "active",
      is_demo: true,
    });
    if (error) throw error;
  }

  console.log("Seed concluído. Org:", orgId);
}

main().catch((e) => { console.error(e); process.exit(1); });

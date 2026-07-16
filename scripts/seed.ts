import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

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
    await admin.from("profiles").upsert({
      id: userId, organization_id: orgId, name: u.name, email: u.email, role: u.role, active: true,
    });
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await admin.from("system_settings").upsert(
      { organization_id: orgId, key, value },
      { onConflict: "organization_id,key" },
    );
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

  console.log("Seed concluído. Org:", orgId);
}

main().catch((e) => { console.error(e); process.exit(1); });

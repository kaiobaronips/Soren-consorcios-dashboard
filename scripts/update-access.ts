import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Admin: substitui o admin@demo.soren.com.br pelo novo login.
// Assessor: cria Felipe Boim como consultant na mesma organização.
const OLD_ADMIN_EMAIL = "admin@demo.soren.com.br";
const ADMIN = { email: "admin@soren.com.br", password: "admin12345", name: "Admin Soren", role: "admin" as const };
const ASSESSOR = { email: "felipeboim@soren.com.br", password: "boim12345", name: "Felipe Boim", role: "consultant" as const };

async function findUserIdByEmail(email: string): Promise<string | undefined> {
  const { data } = await admin.auth.admin.listUsers();
  return data.users.find((u) => u.email === email)?.id;
}

async function main() {
  const { data: org } = await admin.from("organizations").select("id").eq("name", "Soren Consórcios").maybeSingle();
  if (!org) throw new Error("Organização 'Soren Consórcios' não encontrada. Rode o seed antes (pnpm db:seed).");
  const orgId = org.id as string;

  // 1) ADMIN — reutiliza o usuário existente (novo ou antigo) e atualiza e-mail/senha.
  let adminId = (await findUserIdByEmail(ADMIN.email)) ?? (await findUserIdByEmail(OLD_ADMIN_EMAIL));
  if (adminId) {
    const { error } = await admin.auth.admin.updateUserById(adminId, {
      email: ADMIN.email,
      password: ADMIN.password,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN.email,
      password: ADMIN.password,
      email_confirm: true,
    });
    if (error) throw error;
    adminId = data.user!.id;
  }
  const { error: adminProfErr } = await admin.from("profiles").upsert({
    id: adminId, organization_id: orgId, name: ADMIN.name, email: ADMIN.email, role: ADMIN.role, active: true,
  });
  if (adminProfErr) throw adminProfErr;
  console.log(`✔ Admin atualizado: ${ADMIN.email}`);

  // 2) ASSESSOR (Felipe Boim) — cria como consultant, idempotente.
  let assessorId = await findUserIdByEmail(ASSESSOR.email);
  if (assessorId) {
    const { error } = await admin.auth.admin.updateUserById(assessorId, {
      password: ASSESSOR.password,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: ASSESSOR.email,
      password: ASSESSOR.password,
      email_confirm: true,
    });
    if (error) throw error;
    assessorId = data.user!.id;
  }
  const { error: assessorProfErr } = await admin.from("profiles").upsert({
    id: assessorId, organization_id: orgId, name: ASSESSOR.name, email: ASSESSOR.email, role: ASSESSOR.role, active: true,
  });
  if (assessorProfErr) throw assessorProfErr;
  console.log(`✔ Assessor criado: ${ASSESSOR.email} (role: ${ASSESSOR.role})`);

  console.log("Concluído.");
}

main().catch((e) => { console.error(e); process.exit(1); });

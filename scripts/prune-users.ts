import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Mantém apenas estes dois. Qualquer outro usuário é removido junto com seus dados.
const KEEP = new Set(["admin@soren.com.br", "felipeboim@soren.com.br"]);

async function main() {
  const { data } = await admin.auth.admin.listUsers();
  const toDelete = data.users.filter((u) => u.email && !KEEP.has(u.email));

  if (toDelete.length === 0) {
    console.log("Nenhum usuário extra para remover.");
    return;
  }

  for (const u of toDelete) {
    // 1) apaga clientes do consultor (opção escolhida: apagar clientes junto)
    const { error: cErr } = await admin.from("clients").delete().eq("consultant_id", u.id);
    if (cErr) throw cErr;
    // 2) apaga audit_logs (FK NO ACTION → bloquearia o cascade do auth)
    const { error: aErr } = await admin.from("audit_logs").delete().eq("user_id", u.id);
    if (aErr) throw aErr;
    // 3) apaga o usuário do Auth → cascade remove o profile
    const { error: dErr } = await admin.auth.admin.deleteUser(u.id);
    if (dErr) throw dErr;
    console.log(`✔ Removido: ${u.email}`);
  }

  console.log("Concluído. Restantes:", [...KEEP].join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); });

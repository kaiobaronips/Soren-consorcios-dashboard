import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { syncIndexesFromBcb } from "../src/services/sync-indexes";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
}

async function main() {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const result = await syncIndexesFromBcb(admin);
  console.log("=== Sincronização de índices (Banco Central / SGS) ===");
  console.log(`Atualizados: ${result.updated.join(", ") || "nenhum"}`);
  if (result.failed.length > 0) {
    console.log("Falhas (mantido o último valor bom no banco):");
    result.failed.forEach((f) => console.log(`  - ${f.indexCode}: ${f.reason}`));
  }
  // Falha parcial não é erro fatal: o fallback preserva os valores existentes.
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

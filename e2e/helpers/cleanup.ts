import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * Apaga, via service role, todos os registros de teste E2E identificados pelo
 * prefixo "[E2E]" no nome. Usado em afterEach/afterAll para não poluir o banco
 * local entre execuções. Nunca usar em produção — exige SUPABASE_SERVICE_ROLE_KEY.
 */
export async function cleanupE2EData(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local) para limpar dados de E2E",
    );
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // simulations não tem coluna "name" própria — apaga pelas simulações dos clientes de teste.
  const { data: testClients, error: findError } = await admin
    .from("clients")
    .select("id")
    .ilike("name", "[E2E]%");
  if (findError) throw findError;

  const clientIds = (testClients ?? []).map((c: { id: string }) => c.id);
  if (clientIds.length > 0) {
    const { error: simError } = await admin.from("simulations").delete().in("client_id", clientIds);
    if (simError) throw simError;
  }

  const { error: clientError } = await admin.from("clients").delete().ilike("name", "[E2E]%");
  if (clientError) throw clientError;
}

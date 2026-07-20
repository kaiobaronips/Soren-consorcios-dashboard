/**
 * Testes de integração de isolamento por RLS (Fase 7, Tarefa 5 — casos 17 e 18 do prompt).
 *
 * DEPENDÊNCIA: requer o Supabase local rodando e semeado (`pnpm exec supabase status` /
 * `pnpm exec supabase start`). Estes testes fazem chamadas de rede reais contra
 * http://127.0.0.1:54331 (REST + Auth) usando @supabase/supabase-js — não são unitários
 * puros. Ficam neste arquivo (e não em outro projeto Vitest) por simplicidade, seguindo a
 * orientação do brief da tarefa; se a suíte precisar rodar sem rede no futuro, mover para
 * um projeto Vitest separado (ex.: `vitest.integration.config.ts`).
 *
 * Casos cobertos:
 * - Caso 17: isolamento entre consultores da MESMA organização (policy `clients_select`).
 * - Caso 18: isolamento entre ORGANIZAÇÕES distintas (toda policy `organization_id = current_org_id()`).
 *
 * Toda linha de teste criada (clientes, produtos, organização e usuário extra) é removida
 * ao final via service role, incluindo em caso de falha (afterAll roda mesmo se algum
 * teste falhar).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54331";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEMO_PASSWORD = "demo12345";
const ANA_EMAIL = "ana@demo.soren.com.br";
const BRUNO_EMAIL = "bruno@demo.soren.com.br";
const ADMIN_EMAIL = "admin@demo.soren.com.br";

const MARKER = "[E2E]";

// beforeAll/afterAll fazem várias chamadas de rede sequenciais (auth + REST) contra o
// Supabase local; sob carga (containers Docker concorrentes) o default de 10s do Vitest
// pode não bastar.
const HOOK_TIMEOUT_MS = 60_000;

function requireEnv() {
  if (!ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new Error(
      "rls-isolation.test.ts requer NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY " +
        "no ambiente (.env.local) e o Supabase local rodando (pnpm exec supabase start).",
    );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Autentica com retry: sob carga (suíte completa rodando em paralelo), o usuário recém-criado
 * via auth.admin.createUser pode não estar imediatamente visível para signInWithPassword
 * (latência de commit/pool de conexões do Supabase local). Só relevante para o usuário
 * de teste criado no caso 18 — os usuários demo (ana/bruno/admin) já existem há muito tempo
 * e autenticam de primeira, mas o retry é inofensivo para eles também.
 */
async function signInAs(email: string, password: string = DEMO_PASSWORD): Promise<SupabaseClient> {
  requireEnv();
  const client = createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const maxAttempts = 5;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) {
      return client;
    }
    lastError = error.message;
    if (attempt < maxAttempts) {
      await sleep(300 * attempt);
    }
  }
  throw new Error(`Falha ao autenticar como ${email} após ${maxAttempts} tentativas: ${lastError}`);
}

function serviceRoleClient(): SupabaseClient {
  requireEnv();
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("Isolamento RLS entre consultores (caso 17)", () => {
  const admin = serviceRoleClient();
  let anaClient: SupabaseClient;
  let brunoClient: SupabaseClient;
  let adminClient: SupabaseClient;
  let sorenOrgId: string;
  let anaId: string;
  let createdClientId: string;

  beforeAll(async () => {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, organization_id")
      .eq("email", ANA_EMAIL)
      .single();
    if (error || !profile) {
      throw new Error(`Perfil demo da ana não encontrado — rode o seed antes do teste: ${error?.message}`);
    }
    sorenOrgId = profile.organization_id;
    anaId = profile.id;

    anaClient = await signInAs(ANA_EMAIL);
    brunoClient = await signInAs(BRUNO_EMAIL);
    adminClient = await signInAs(ADMIN_EMAIL);

    const { data: created, error: insertError } = await anaClient
      .from("clients")
      .insert({
        organization_id: sorenOrgId,
        consultant_id: anaId,
        name: `${MARKER} Cliente da Ana`,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError || !created) {
      throw new Error(`Falha ao criar cliente de teste (ana): ${insertError?.message}`);
    }
    createdClientId = created.id;
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await admin.from("clients").delete().like("name", `${MARKER}%`);
  }, HOOK_TIMEOUT_MS);

  it("bruno (consultant, mesma org) NÃO enxerga o cliente da ana", async () => {
    const { data, error } = await brunoClient
      .from("clients")
      .select("id")
      .eq("id", createdClientId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("ana enxerga o próprio cliente", async () => {
    const { data, error } = await anaClient
      .from("clients")
      .select("id")
      .eq("id", createdClientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("admin (staff, mesma org) enxerga o cliente da ana", async () => {
    const { data, error } = await adminClient
      .from("clients")
      .select("id")
      .eq("id", createdClientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("Isolamento RLS entre organizações (caso 18)", () => {
  const admin = serviceRoleClient();
  let sorenOrgId: string;
  let anaId: string;
  let anaClient: SupabaseClient;

  let outroOrgId: string;
  let outroUserId: string;
  let outroClient: SupabaseClient;

  const outroEmail = `e2e-outro-org-${Date.now()}@teste.soren.com.br`;
  const outroPassword = "teste-e2e-12345";

  let sorenClientId: string;
  let sorenProductId: string;
  let outroClientId: string;
  let outroProductId: string;

  beforeAll(async () => {
    const { data: anaProfile, error: anaError } = await admin
      .from("profiles")
      .select("id, organization_id")
      .eq("email", ANA_EMAIL)
      .single();
    if (anaError || !anaProfile) {
      throw new Error(`Perfil demo da ana não encontrado: ${anaError?.message}`);
    }
    sorenOrgId = anaProfile.organization_id;
    anaId = anaProfile.id;
    anaClient = await signInAs(ANA_EMAIL);

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: `${MARKER} Organização de Teste`, document: "11.111.111/0001-11" })
      .select("id")
      .single();
    if (orgError || !org) {
      throw new Error(`Falha ao criar 2ª organização de teste: ${orgError?.message}`);
    }
    outroOrgId = org.id;

    const { data: created, error: createUserError } = await admin.auth.admin.createUser({
      email: outroEmail,
      password: outroPassword,
      email_confirm: true,
    });
    if (createUserError || !created.user) {
      throw new Error(`Falha ao criar usuário de teste: ${createUserError?.message}`);
    }
    outroUserId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: outroUserId,
      organization_id: outroOrgId,
      name: `${MARKER} Usuário Outra Org`,
      email: outroEmail,
      role: "admin",
      active: true,
    });
    if (profileError) {
      throw new Error(`Falha ao criar profile do usuário de teste: ${profileError.message}`);
    }

    outroClient = await signInAs(outroEmail, outroPassword);

    // dado de negócio em cada organização, criado via service role para não depender de RLS de insert
    const { data: sorenClient, error: sorenClientErr } = await admin
      .from("clients")
      .insert({
        organization_id: sorenOrgId,
        consultant_id: anaId,
        name: `${MARKER} Cliente Soren`,
        status: "active",
      })
      .select("id")
      .single();
    if (sorenClientErr || !sorenClient) {
      throw new Error(`Falha ao semear cliente Soren: ${sorenClientErr?.message}`);
    }
    sorenClientId = sorenClient.id;

    const { data: sorenProduct, error: sorenProductErr } = await admin
      .from("consortium_products")
      .insert({
        organization_id: sorenOrgId,
        administrator_name: `${MARKER} Administradora Soren`,
        category: "vehicle",
        product_name: `${MARKER} Produto Soren`,
        product_code: `E2E-SOREN-${Date.now()}`,
        credit_amount: 50000,
        term_months: 60,
        total_administration_fee_percent: 15,
        regular_installment_amount: 900,
      })
      .select("id")
      .single();
    if (sorenProductErr || !sorenProduct) {
      throw new Error(`Falha ao semear produto Soren: ${sorenProductErr?.message}`);
    }
    sorenProductId = sorenProduct.id;

    const { data: outroClientRow, error: outroClientErr } = await admin
      .from("clients")
      .insert({
        organization_id: outroOrgId,
        consultant_id: outroUserId,
        name: `${MARKER} Cliente Outra Org`,
        status: "active",
      })
      .select("id")
      .single();
    if (outroClientErr || !outroClientRow) {
      throw new Error(`Falha ao semear cliente outra org: ${outroClientErr?.message}`);
    }
    outroClientId = outroClientRow.id;

    const { data: outroProductRow, error: outroProductErr } = await admin
      .from("consortium_products")
      .insert({
        organization_id: outroOrgId,
        administrator_name: `${MARKER} Administradora Outra Org`,
        category: "vehicle",
        product_name: `${MARKER} Produto Outra Org`,
        product_code: `E2E-OUTRO-${Date.now()}`,
        credit_amount: 30000,
        term_months: 48,
        total_administration_fee_percent: 12,
        regular_installment_amount: 700,
      })
      .select("id")
      .single();
    if (outroProductErr || !outroProductRow) {
      throw new Error(`Falha ao semear produto outra org: ${outroProductErr?.message}`);
    }
    outroProductId = outroProductRow.id;
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    // limpeza — ordem: dados de negócio, depois profile/auth user, depois organização.
    await admin.from("clients").delete().like("name", `${MARKER}%`);
    await admin.from("consortium_products").delete().like("product_name", `${MARKER}%`);
    if (outroUserId) {
      await admin.from("profiles").delete().eq("id", outroUserId);
      await admin.auth.admin.deleteUser(outroUserId);
    }
    if (outroOrgId) {
      await admin.from("organizations").delete().eq("id", outroOrgId);
    }
  }, HOOK_TIMEOUT_MS);

  it("usuário da 2ª organização NÃO enxerga clientes da Soren Consórcios", async () => {
    const { data, error } = await outroClient.from("clients").select("id").eq("id", sorenClientId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("usuário da 2ª organização NÃO enxerga produtos da Soren Consórcios", async () => {
    const { data, error } = await outroClient
      .from("consortium_products")
      .select("id")
      .eq("id", sorenProductId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("usuário da 2ª organização enxerga os próprios dados", async () => {
    const { data: clientData, error: clientErr } = await outroClient
      .from("clients")
      .select("id")
      .eq("id", outroClientId);
    expect(clientErr).toBeNull();
    expect(clientData).toHaveLength(1);

    const { data: productData, error: productErr } = await outroClient
      .from("consortium_products")
      .select("id")
      .eq("id", outroProductId);
    expect(productErr).toBeNull();
    expect(productData).toHaveLength(1);
  });

  it("usuário da Soren Consórcios (ana) NÃO enxerga dados da 2ª organização", async () => {
    const { data: clientData, error: clientErr } = await anaClient
      .from("clients")
      .select("id")
      .eq("id", outroClientId);
    expect(clientErr).toBeNull();
    expect(clientData ?? []).toHaveLength(0);

    const { data: productData, error: productErr } = await anaClient
      .from("consortium_products")
      .select("id")
      .eq("id", outroProductId);
    expect(productErr).toBeNull();
    expect(productData ?? []).toHaveLength(0);
  });
});

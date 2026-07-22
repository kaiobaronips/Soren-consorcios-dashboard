/**
 * Testes de integração de isolamento por RLS (Fase 7, Tarefa 5 — casos 17 e 18 do prompt).
 *
 * DEPENDÊNCIA: requer apenas o Supabase local rodando (`pnpm exec supabase start`). Faz
 * chamadas de rede reais contra http://127.0.0.1:54331 (REST + Auth) usando
 * @supabase/supabase-js — não são unitários puros.
 *
 * HERMÉTICO: NÃO depende do seed. Cada bloco provisiona suas próprias organizações e
 * usuários via service role (emails únicos por execução) e remove tudo no `afterAll`
 * (que roda mesmo em falha). Antes o teste dependia de usuários demo fixos (ana/bruno);
 * quando o seed passou a criar usuários reais de produção, o teste quebrou — acoplar
 * teste↔seed é o que se evita aqui.
 *
 * Casos cobertos:
 * - Caso 17: isolamento entre consultores da MESMA organização (policy `clients_select`).
 * - Caso 18: isolamento entre ORGANIZAÇÕES distintas (toda policy `organization_id = current_org_id()`).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54331";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MARKER = "[E2E]";
// Sufixo único por execução: evita colisão de email/product_code entre re-runs.
const RUN = `${Date.now()}`;
const TEST_PASSWORD = "teste-e2e-12345";

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
 * (latência de commit/pool de conexões do Supabase local).
 */
async function signInAs(email: string, password: string = TEST_PASSWORD): Promise<SupabaseClient> {
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

type TestRole = "admin" | "manager" | "consultant";
type TestUser = { userId: string; email: string; client: SupabaseClient };

/** Cria uma organização de teste (via service role) e devolve seu id. */
async function createOrg(admin: SupabaseClient, label: string): Promise<string> {
  const { data, error } = await admin
    .from("organizations")
    .insert({ name: `${MARKER} ${label} ${RUN}`, document: "11.111.111/0001-11" })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Falha ao criar organização de teste (${label}): ${error?.message}`);
  }
  return data.id;
}

/** Cria um auth user + profile (via service role) numa org e já autentica o client dele. */
async function createUser(
  admin: SupabaseClient,
  orgId: string,
  role: TestRole,
  label: string,
): Promise<TestUser> {
  const email = `e2e-${label}-${RUN}@teste.soren.com.br`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !created.user) {
    throw new Error(`Falha ao criar usuário de teste (${label}): ${error?.message}`);
  }
  const userId = created.user.id;
  const { error: profErr } = await admin.from("profiles").insert({
    id: userId,
    organization_id: orgId,
    name: `${MARKER} ${label}`,
    email,
    role,
    active: true,
  });
  if (profErr) {
    throw new Error(`Falha ao criar profile de teste (${label}): ${profErr.message}`);
  }
  const client = await signInAs(email);
  return { userId, email, client };
}

/** Remove usuários, profiles e organizações de teste, além de dados marcados com [E2E]. */
async function cleanup(admin: SupabaseClient, userIds: string[], orgIds: string[]) {
  await admin.from("clients").delete().like("name", `${MARKER}%`);
  await admin.from("consortium_products").delete().like("product_name", `${MARKER}%`);
  for (const id of userIds) {
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
  }
  for (const id of orgIds) {
    await admin.from("organizations").delete().eq("id", id);
  }
}

describe("Isolamento RLS entre consultores (caso 17)", () => {
  const admin = serviceRoleClient();
  const userIds: string[] = [];
  const orgIds: string[] = [];
  let consultorA: TestUser;
  let consultorB: TestUser;
  let adminUser: TestUser;
  let createdClientId: string;

  beforeAll(async () => {
    const orgId = await createOrg(admin, "Org Caso17");
    orgIds.push(orgId);
    consultorA = await createUser(admin, orgId, "consultant", "c17a");
    consultorB = await createUser(admin, orgId, "consultant", "c17b");
    adminUser = await createUser(admin, orgId, "admin", "c17admin");
    userIds.push(consultorA.userId, consultorB.userId, adminUser.userId);

    const { data: created, error: insertError } = await consultorA.client
      .from("clients")
      .insert({
        organization_id: orgId,
        consultant_id: consultorA.userId,
        name: `${MARKER} Cliente do Consultor A`,
        status: "active",
      })
      .select("id")
      .single();
    if (insertError || !created) {
      throw new Error(`Falha ao criar cliente de teste (consultor A): ${insertError?.message}`);
    }
    createdClientId = created.id;
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await cleanup(admin, userIds, orgIds);
  }, HOOK_TIMEOUT_MS);

  it("consultor B (mesma org) NÃO enxerga o cliente do consultor A", async () => {
    const { data, error } = await consultorB.client
      .from("clients")
      .select("id")
      .eq("id", createdClientId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("consultor A enxerga o próprio cliente", async () => {
    const { data, error } = await consultorA.client
      .from("clients")
      .select("id")
      .eq("id", createdClientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("admin (staff, mesma org) enxerga o cliente do consultor A", async () => {
    const { data, error } = await adminUser.client
      .from("clients")
      .select("id")
      .eq("id", createdClientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("Isolamento RLS entre organizações (caso 18)", () => {
  const admin = serviceRoleClient();
  const userIds: string[] = [];
  const orgIds: string[] = [];

  let org1Id: string;
  let org2Id: string;
  let userOrg1: TestUser;
  let userOrg2: TestUser;

  let org1ClientId: string;
  let org1ProductId: string;
  let org2ClientId: string;
  let org2ProductId: string;

  beforeAll(async () => {
    org1Id = await createOrg(admin, "Org1 Caso18");
    org2Id = await createOrg(admin, "Org2 Caso18");
    orgIds.push(org1Id, org2Id);
    userOrg1 = await createUser(admin, org1Id, "consultant", "c18org1");
    userOrg2 = await createUser(admin, org2Id, "admin", "c18org2");
    userIds.push(userOrg1.userId, userOrg2.userId);

    // dado de negócio em cada organização, criado via service role (não depende de RLS de insert)
    const { data: org1Client, error: org1ClientErr } = await admin
      .from("clients")
      .insert({
        organization_id: org1Id,
        consultant_id: userOrg1.userId,
        name: `${MARKER} Cliente Org1`,
        status: "active",
      })
      .select("id")
      .single();
    if (org1ClientErr || !org1Client) {
      throw new Error(`Falha ao semear cliente org1: ${org1ClientErr?.message}`);
    }
    org1ClientId = org1Client.id;

    const { data: org1Product, error: org1ProductErr } = await admin
      .from("consortium_products")
      .insert({
        organization_id: org1Id,
        administrator_name: `${MARKER} Administradora Org1`,
        category: "vehicle",
        product_name: `${MARKER} Produto Org1`,
        product_code: `E2E-ORG1-${RUN}`,
        credit_amount: 50000,
        term_months: 60,
        total_administration_fee_percent: 15,
        regular_installment_amount: 900,
      })
      .select("id")
      .single();
    if (org1ProductErr || !org1Product) {
      throw new Error(`Falha ao semear produto org1: ${org1ProductErr?.message}`);
    }
    org1ProductId = org1Product.id;

    const { data: org2Client, error: org2ClientErr } = await admin
      .from("clients")
      .insert({
        organization_id: org2Id,
        consultant_id: userOrg2.userId,
        name: `${MARKER} Cliente Org2`,
        status: "active",
      })
      .select("id")
      .single();
    if (org2ClientErr || !org2Client) {
      throw new Error(`Falha ao semear cliente org2: ${org2ClientErr?.message}`);
    }
    org2ClientId = org2Client.id;

    const { data: org2Product, error: org2ProductErr } = await admin
      .from("consortium_products")
      .insert({
        organization_id: org2Id,
        administrator_name: `${MARKER} Administradora Org2`,
        category: "vehicle",
        product_name: `${MARKER} Produto Org2`,
        product_code: `E2E-ORG2-${RUN}`,
        credit_amount: 30000,
        term_months: 48,
        total_administration_fee_percent: 12,
        regular_installment_amount: 700,
      })
      .select("id")
      .single();
    if (org2ProductErr || !org2Product) {
      throw new Error(`Falha ao semear produto org2: ${org2ProductErr?.message}`);
    }
    org2ProductId = org2Product.id;
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await cleanup(admin, userIds, orgIds);
  }, HOOK_TIMEOUT_MS);

  it("usuário da org2 NÃO enxerga clientes da org1", async () => {
    const { data, error } = await userOrg2.client.from("clients").select("id").eq("id", org1ClientId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("usuário da org2 NÃO enxerga produtos da org1", async () => {
    const { data, error } = await userOrg2.client
      .from("consortium_products")
      .select("id")
      .eq("id", org1ProductId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("usuário da org2 enxerga os próprios dados", async () => {
    const { data: clientData, error: clientErr } = await userOrg2.client
      .from("clients")
      .select("id")
      .eq("id", org2ClientId);
    expect(clientErr).toBeNull();
    expect(clientData).toHaveLength(1);

    const { data: productData, error: productErr } = await userOrg2.client
      .from("consortium_products")
      .select("id")
      .eq("id", org2ProductId);
    expect(productErr).toBeNull();
    expect(productData).toHaveLength(1);
  });

  it("usuário da org1 NÃO enxerga dados da org2", async () => {
    const { data: clientData, error: clientErr } = await userOrg1.client
      .from("clients")
      .select("id")
      .eq("id", org2ClientId);
    expect(clientErr).toBeNull();
    expect(clientData ?? []).toHaveLength(0);

    const { data: productData, error: productErr } = await userOrg1.client
      .from("consortium_products")
      .select("id")
      .eq("id", org2ProductId);
    expect(productErr).toBeNull();
    expect(productData ?? []).toHaveLength(0);
  });
});

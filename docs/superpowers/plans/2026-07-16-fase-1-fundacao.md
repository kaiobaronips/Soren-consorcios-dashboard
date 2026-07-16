# Fase 1 — Fundação: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Projeto Next.js + Supabase local funcionando com autenticação, 11 tabelas com RLS, seed de organização demo e layout base — pronto para receber as features das fases 2–7.

**Architecture:** Server-first (Abordagem A da spec): Server Components/Actions → services → repositories → Supabase. Domínio puro em `src/domain` (ainda vazio nesta fase, criado com utilitário de formatação como semente do padrão). RLS por `organization_id` como defesa em profundidade.

**Tech Stack:** Next.js (App Router, versão estável atual), TypeScript estrito, Tailwind CSS, shadcn/ui, Supabase CLI (Postgres/Auth local), `@supabase/ssr`, Zod, Vitest, pnpm.

## Global Constraints (da spec — valem para TODAS as tasks)

- TypeScript `strict: true`; nunca desativar. Lint sem erros.
- Dinheiro: `NUMERIC(14,2)` no banco; **nunca** float binário para persistir dinheiro.
- Percentuais: `NUMERIC(6,3)` representando pontos percentuais (26,8% → `26.800`).
- Nenhuma taxa financeira hardcoded em código; valores em `financial_indexes`/`system_settings`.
- Idioma da UI: pt-BR. Moeda BRL, datas `dd/MM/yyyy`, fuso `America/Sao_Paulo`.
- UI neutra shadcn/ui — NENHUMA decisão de identidade visual (cores de marca, logos, tipografia própria).
- Segredos apenas em `.env.local` (gitignored); `.env.example` documentado.
- Commits atômicos por task; mensagens em português, convencional (`feat:`, `chore:`, `docs:`...) terminando com `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Gerenciador de pacotes: `pnpm`. Diretório do projeto: `/Users/kaiobp/Documents/Soren-Consorcio-dashboard`.
- Pré-requisito de ambiente: Docker rodando (Supabase local).

---

### Task 1: Scaffold Next.js + TypeScript estrito + Tailwind + shadcn/ui + Vitest

**Files:**
- Create: raiz do projeto via `create-next-app` (src dir), `vitest.config.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`
- Modify: `package.json` (scripts), `tsconfig.json` (strict já vem, conferir), `.gitignore` (já existe — manter entradas atuais)

**Interfaces:**
- Produces: `formatCurrency(value: number | string): string` e `formatDate(date: Date | string): string` em `src/lib/format.ts` (usadas em toda UI a partir da F2); estrutura de pastas `src/{app,components,features,domain,services,repositories,lib,types}`.

- [ ] **Step 1: Scaffold do Next.js dentro da pasta existente**

```bash
cd /Users/kaiobp/Documents/Soren-Consorcio-dashboard
pnpm dlx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Se o CLI reclamar de pasta não-vazia (docs/, references/, .git), responder para continuar; se não permitir, criar em `/tmp/scaffold` e mover o conteúdo (exceto `.git`) para a raiz do projeto.

- [ ] **Step 2: Conferir TypeScript estrito**

`tsconfig.json` deve conter `"strict": true`. Se não, adicionar.

- [ ] **Step 3: Inicializar shadcn/ui com tema neutro**

```bash
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card input label table badge dialog dropdown-menu sonner sidebar separator avatar
```

- [ ] **Step 4: Instalar e configurar Vitest**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react
```

Criar `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

Adicionar scripts ao `package.json`:

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Escrever teste que falha para formatadores pt-BR**

Criar `src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatPercent } from "./format";

describe("formatCurrency", () => {
  it("formata BRL pt-BR", () => {
    expect(formatCurrency(3220)).toBe("R$ 3.220,00");
    expect(formatCurrency("3112.67")).toBe("R$ 3.112,67");
  });
});

describe("formatPercent", () => {
  it("formata pontos percentuais com 2 casas quando necessário", () => {
    expect(formatPercent(26.8)).toBe("26,80%");
  });
});

describe("formatDate", () => {
  it("formata dd/MM/yyyy no fuso America/Sao_Paulo", () => {
    expect(formatDate(new Date("2026-07-16T03:00:00Z"))).toBe("16/07/2026");
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 7: Implementar `src/lib/format.ts`**

```ts
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PCT = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Formata valor monetário em BRL. Aceita number ou string decimal vinda do banco (NUMERIC chega como string). */
export function formatCurrency(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return BRL.format(n).replace(/ /g, " ");
}

/** Formata pontos percentuais (26.8 → "26,80%"). */
export function formatPercent(points: number | string): string {
  const n = typeof points === "string" ? Number(points) : points;
  return `${PCT.format(n)}%`;
}

/** Formata data como dd/MM/yyyy em America/Sao_Paulo. */
export function formatDate(date: Date | string): string {
  return DATE.format(typeof date === "string" ? new Date(date) : date);
}
```

Nota: `Intl` BRL usa espaço não separável (` `) entre "R$" e o número — o `replace` normaliza para o teste e para consistência visual.

- [ ] **Step 8: Rodar testes e lint**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: tudo PASS.

- [ ] **Step 9: Criar esqueleto de pastas do padrão arquitetural**

```bash
mkdir -p src/components src/features src/domain src/services src/repositories src/types
```

Criar `src/domain/README.md`:

```md
# src/domain

Funções puras de regra de negócio (elegibilidade, ranking, cálculos financeiros).
REGRAS: zero dependência de React/Next/Supabase; dinheiro e taxas com decimal.js;
100% coberto por testes unitários. Ver docs/CALCULATIONS.md.
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TS estrito + Tailwind + shadcn/ui + Vitest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: docs/ANALISE_PLANILHA.md

**Files:**
- Create: `docs/ANALISE_PLANILHA.md`

**Interfaces:**
- Produces: documento de referência das regras da planilha; o oráculo de testes (tabela de clientes) e as fórmulas serão consumidos pelos testes das fases 2–4.

- [ ] **Step 1: Escrever o documento**

Conteúdo obrigatório (dados já verificados na análise da spec, seção 3 — copiar de lá as tabelas e fórmulas):

1. Inventário das 5 abas (Dashboard, Cartões, Consórcios, Clientes, Oportunidades) com propósito de cada uma.
2. Estrutura da tabela de produtos: Produto, Código, Valor da Carta, Prazo (200/220/240), Taxa Adm Total (24,8/25,8/26,8%), Parcela 1ª–12ª, Parcela Mensal. 63 produtos, cartas 120k–600k.
3. Fórmulas descobertas (com exemplos de verificação):
   - `parcela_mensal = carta × (1 + taxa_adm + 0,02) ÷ prazo` (2% = fundo de reserva implícito; verificação IE580-240m → 3.112,67)
   - `parcela_1a_a_12a = parcela_mensal + 0,001 × carta` (verificação IE600 → +600)
   - `maior_carta_pagavel = MAXIFS(carta; parcela_mensal <= dividendo)`
   - `produtos_elegiveis = COUNTIFS(parcela_mensal <= dividendo)`
   - `folga = dividendo − parcela`; elegível se `parcela <= dividendo`
4. Oráculo de testes: João Silva (1.500 → 240.000 / 23), Maria Souza (3.200 → 580.000 / 56), Carlos Pereira (800 → 140.000 / 6), JANDIRINHA (4.550 → 600.000 / 63).
5. Observações: planilha não tem renda mensal (só valor disponível); "dividendo mensal" = `monthly_available_amount`; abas Cartões/Dashboard/Oportunidades são visualizações derivadas (não geram tabelas próprias no sistema).
6. Mapeamento planilha → banco: colunas da aba Consórcios → campos de `consortium_products` (incluindo `reserve_fund_percent = 2.000` e categoria `property`).

- [ ] **Step 2: Commit**

```bash
git add docs/ANALISE_PLANILHA.md
git commit -m "docs: análise completa da planilha de referência (ANALISE_PLANILHA.md)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Supabase local + migration 0001 (organizations, profiles, helpers)

**Files:**
- Create: `supabase/config.toml` (via CLI), `supabase/migrations/0001_core.sql`, `.env.example`, `.env.local`

**Interfaces:**
- Produces: enum `user_role ('admin','manager','consultant')`; tabelas `organizations`, `profiles`; funções SQL `public.current_org_id() returns uuid` e `public.current_user_role() returns user_role`; trigger `set_updated_at` reutilizável. Todas as migrations seguintes dependem destes nomes.

- [ ] **Step 1: Instalar CLI e inicializar Supabase local**

```bash
pnpm add -D supabase
pnpm supabase init
pnpm supabase start
```

Expected: serviços sobem; CLI imprime `API URL`, `anon key`, `service_role key`, `DB URL`.

- [ ] **Step 2: Criar `.env.example` e `.env.local`**

`.env.example` (documentado, sem valores):

```bash
# URL pública do projeto Supabase (local: http://127.0.0.1:54321)
NEXT_PUBLIC_SUPABASE_URL=
# Chave anônima (pública) do Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Chave service_role — SOMENTE servidor/scripts. Nunca expor no frontend.
SUPABASE_SERVICE_ROLE_KEY=
# Conexão direta ao Postgres (scripts/migrations)
DATABASE_URL=
# URL base da aplicação
APP_URL=http://localhost:3000
# Limite de upload de PDF em MB (Fase 6)
MAX_PDF_SIZE_MB=20
# Habilita sincronização automática de índices econômicos (futuro)
ENABLE_INDEX_SYNC=false
```

`.env.local`: mesmos nomes preenchidos com os valores do `supabase start`. Conferir que `.gitignore` cobre `.env.local`.

- [ ] **Step 3: Escrever migration 0001**

```bash
pnpm supabase migration new core
```

Conteúdo do arquivo gerado (`supabase/migrations/<timestamp>_core.sql`):

```sql
-- 0001 core: organizations, profiles, helpers de RLS
create type public.user_role as enum ('admin', 'manager', 'consultant');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  name text not null,
  email text not null,
  phone text,
  role public.user_role not null default 'consultant',
  manager_id uuid references public.profiles (id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles (organization_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helpers usados por TODAS as policies de RLS
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

create policy org_select on public.organizations for select
  using (id = public.current_org_id());
create policy org_update on public.organizations for update
  using (id = public.current_org_id() and public.current_user_role() = 'admin');

create policy profiles_select on public.profiles for select
  using (organization_id = public.current_org_id());
create policy profiles_admin_all on public.profiles for all
  using (organization_id = public.current_org_id() and public.current_user_role() = 'admin');
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid());
```

- [ ] **Step 4: Aplicar e verificar**

Run: `pnpm supabase db reset`
Expected: migration aplica sem erro.

Run: `pnpm supabase db diff` (ou `psql "$DATABASE_URL" -c "\d public.profiles"`)
Expected: tabelas existem, RLS `enabled`.

- [ ] **Step 5: Commit**

```bash
git add supabase/ .env.example package.json pnpm-lock.yaml
git commit -m "feat: Supabase local + migration core (organizations, profiles, helpers RLS)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Migration 0002 — tabelas de negócio

**Files:**
- Create: `supabase/migrations/<timestamp>_business.sql` (via `pnpm supabase migration new business`)

**Interfaces:**
- Produces: enums `product_category ('property','vehicle','other')`, `correction_index ('IGPM','IPCA','INCC','NONE','CUSTOM')`, `product_status ('draft','active','inactive','archived')`, `document_status ('uploaded','processing','review_required','completed','failed')`, `opportunity_stage ('novo_lead','contato_realizado','diagnostico','simulacao_apresentada','documentacao','proposta','negociacao','venda_concluida','perdido')`, `interaction_type ('note','call','whatsapp','email','meeting','system')`, `index_code ('IGPM','IPCA','CDI','SAVINGS','CUSTOM')`. Tabelas: `clients`, `consortium_products`, `product_documents`, `simulations`, `opportunities`, `interactions`, `financial_indexes`, `system_settings`, `audit_logs`.

- [ ] **Step 1: Escrever a migration**

```sql
-- 0002 business: tabelas de domínio
create type public.product_category as enum ('property','vehicle','other');
create type public.correction_index as enum ('IGPM','IPCA','INCC','NONE','CUSTOM');
create type public.product_status as enum ('draft','active','inactive','archived');
create type public.document_status as enum ('uploaded','processing','review_required','completed','failed');
create type public.opportunity_stage as enum ('novo_lead','contato_realizado','diagnostico',
  'simulacao_apresentada','documentacao','proposta','negociacao','venda_concluida','perdido');
create type public.interaction_type as enum ('note','call','whatsapp','email','meeting','system');
create type public.index_code as enum ('IGPM','IPCA','CDI','SAVINGS','CUSTOM');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  consultant_id uuid not null references public.profiles (id),
  name text not null,
  email text,
  phone text,
  cpf text,
  birth_date date,
  monthly_income numeric(14,2),
  monthly_available_amount numeric(14,2),
  occupation text,
  city text,
  state text,
  lead_source text,
  notes text,
  status text not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_org_idx on public.clients (organization_id);
create index clients_consultant_idx on public.clients (consultant_id);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create table public.product_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_hash text not null,
  status public.document_status not null default 'uploaded',
  extraction_log jsonb not null default '[]',
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index product_documents_org_idx on public.product_documents (organization_id);

create table public.consortium_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  administrator_name text not null,
  category public.product_category not null,
  product_name text not null,
  product_code text not null,
  credit_amount numeric(14,2) not null check (credit_amount > 0),
  term_months integer not null check (term_months > 0),
  total_administration_fee_percent numeric(6,3) not null,
  first_installment_amount numeric(14,2),
  first_12_installment_amount numeric(14,2),
  regular_installment_amount numeric(14,2) not null check (regular_installment_amount > 0),
  reserve_fund_percent numeric(6,3),
  insurance_amount numeric(14,2),
  correction_index public.correction_index not null default 'NONE',
  correction_frequency_months integer not null default 12,
  default_projected_annual_rate numeric(6,3),
  valid_from date,
  valid_until date,
  status public.product_status not null default 'active',
  is_demo boolean not null default false,
  source_document_id uuid references public.product_documents (id),
  source_page integer,
  extraction_confidence numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_org_status_idx on public.consortium_products (organization_id, status);
create index products_eligibility_idx on public.consortium_products (organization_id, regular_installment_amount);
create unique index products_dedup_idx on public.consortium_products
  (organization_id, product_code, category, term_months, credit_amount);
create trigger products_updated_at before update on public.consortium_products
  for each row execute function public.set_updated_at();

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid not null references public.clients (id),
  consultant_id uuid not null references public.profiles (id),
  product_id uuid references public.consortium_products (id),
  monthly_available_amount_snapshot numeric(14,2) not null,
  monthly_income_snapshot numeric(14,2),
  product_snapshot jsonb not null,
  assumptions_snapshot jsonb not null,
  selected_year integer,
  base_credit_amount numeric(14,2) not null,
  projected_credit_amount numeric(14,2),
  base_installment_amount numeric(14,2) not null,
  projected_installment_amount numeric(14,2),
  projected_total_paid numeric(14,2),
  cdi_comparison_value numeric(14,2),
  status text not null default 'saved',
  created_at timestamptz not null default now()
);
create index simulations_org_idx on public.simulations (organization_id);
create index simulations_client_idx on public.simulations (client_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid not null references public.clients (id),
  consultant_id uuid not null references public.profiles (id),
  simulation_id uuid references public.simulations (id),
  product_id uuid references public.consortium_products (id),
  stage public.opportunity_stage not null default 'novo_lead',
  stage_entered_at timestamptz not null default now(),
  estimated_credit_amount numeric(14,2),
  estimated_revenue numeric(14,2),
  probability_percent numeric(5,2),
  next_follow_up_at timestamptz,
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index opportunities_org_stage_idx on public.opportunities (organization_id, stage);
create index opportunities_consultant_idx on public.opportunities (consultant_id);
create trigger opportunities_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid not null references public.clients (id),
  opportunity_id uuid references public.opportunities (id),
  consultant_id uuid not null references public.profiles (id),
  type public.interaction_type not null default 'note',
  content text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index interactions_client_idx on public.interactions (client_id, occurred_at desc);

create table public.financial_indexes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id), -- null = global
  index_code public.index_code not null,
  reference_period date not null,
  monthly_rate numeric(9,6),
  annual_rate numeric(9,6),
  source text not null,
  source_url text,
  projected boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index financial_indexes_period_idx on public.financial_indexes
  (index_code, reference_period, (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)));

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  key text not null,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_state jsonb,
  new_state jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);
```

- [ ] **Step 2: Aplicar e verificar**

Run: `pnpm supabase db reset`
Expected: 0001 + 0002 aplicam sem erro. `psql "$DATABASE_URL" -c "\dt public.*"` lista as 11 tabelas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: migration das tabelas de negócio (11 tabelas, enums, índices)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Migration 0003 — RLS de todas as tabelas de negócio

**Files:**
- Create: `supabase/migrations/<timestamp>_rls.sql`

**Interfaces:**
- Consumes: `public.current_org_id()`, `public.current_user_role()` (Task 3).
- Produces: políticas nomeadas `<tabela>_org_isolation` (+ específicas). Padrão de acesso que os repositories da F2+ assumem: consultor vê/edita só o que é dele em clients/simulations/opportunities/interactions; admin/manager veem a organização; produtos/índices/settings são org-wide (escrita admin/manager).

- [ ] **Step 1: Escrever a migration**

```sql
-- 0003 RLS: isolamento por organização + papel
alter table public.clients enable row level security;
alter table public.consortium_products enable row level security;
alter table public.product_documents enable row level security;
alter table public.simulations enable row level security;
alter table public.opportunities enable row level security;
alter table public.interactions enable row level security;
alter table public.financial_indexes enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_org_staff()
returns boolean language sql stable as $$
  select public.current_user_role() in ('admin','manager');
$$;

-- clients: consultor vê os seus; staff vê a org
create policy clients_select on public.clients for select
  using (organization_id = public.current_org_id()
         and (consultant_id = auth.uid() or public.is_org_staff()));
create policy clients_insert on public.clients for insert
  with check (organization_id = public.current_org_id());
create policy clients_update on public.clients for update
  using (organization_id = public.current_org_id()
         and (consultant_id = auth.uid() or public.is_org_staff()));

-- simulations / opportunities / interactions: mesmo padrão de clients
create policy simulations_select on public.simulations for select
  using (organization_id = public.current_org_id()
         and (consultant_id = auth.uid() or public.is_org_staff()));
create policy simulations_insert on public.simulations for insert
  with check (organization_id = public.current_org_id() and consultant_id = auth.uid());

create policy opportunities_select on public.opportunities for select
  using (organization_id = public.current_org_id()
         and (consultant_id = auth.uid() or public.is_org_staff()));
create policy opportunities_insert on public.opportunities for insert
  with check (organization_id = public.current_org_id());
create policy opportunities_update on public.opportunities for update
  using (organization_id = public.current_org_id()
         and (consultant_id = auth.uid() or public.is_org_staff()));

create policy interactions_select on public.interactions for select
  using (organization_id = public.current_org_id()
         and (consultant_id = auth.uid() or public.is_org_staff()));
create policy interactions_insert on public.interactions for insert
  with check (organization_id = public.current_org_id() and consultant_id = auth.uid());

-- produtos: leitura org-wide; escrita staff
create policy products_select on public.consortium_products for select
  using (organization_id = public.current_org_id());
create policy products_write on public.consortium_products for all
  using (organization_id = public.current_org_id() and public.is_org_staff())
  with check (organization_id = public.current_org_id() and public.is_org_staff());

-- documentos de produto: staff apenas
create policy product_documents_staff on public.product_documents for all
  using (organization_id = public.current_org_id() and public.is_org_staff())
  with check (organization_id = public.current_org_id() and public.is_org_staff());

-- índices financeiros: leitura org + globais; escrita admin
create policy financial_indexes_select on public.financial_indexes for select
  using (organization_id is null or organization_id = public.current_org_id());
create policy financial_indexes_write on public.financial_indexes for all
  using (organization_id = public.current_org_id() and public.current_user_role() = 'admin')
  with check (organization_id = public.current_org_id() and public.current_user_role() = 'admin');

-- settings: leitura org; escrita admin
create policy system_settings_select on public.system_settings for select
  using (organization_id = public.current_org_id());
create policy system_settings_write on public.system_settings for all
  using (organization_id = public.current_org_id() and public.current_user_role() = 'admin')
  with check (organization_id = public.current_org_id() and public.current_user_role() = 'admin');

-- audit: insert por qualquer usuário da org; leitura admin
create policy audit_logs_insert on public.audit_logs for insert
  with check (organization_id = public.current_org_id());
create policy audit_logs_select on public.audit_logs for select
  using (organization_id = public.current_org_id() and public.current_user_role() = 'admin');
```

- [ ] **Step 2: Aplicar e verificar**

Run: `pnpm supabase db reset`
Expected: aplica sem erro. `psql "$DATABASE_URL" -c "select tablename, policyname from pg_policies where schemaname='public' order by 1;"` lista as políticas acima.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: RLS completo — isolamento por organização e por consultor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Seed — organização demo, usuários, settings, índices

**Files:**
- Create: `scripts/seed.ts`
- Modify: `package.json` (script `db:seed`)

**Interfaces:**
- Consumes: schema das Tasks 3–5; `SUPABASE_SERVICE_ROLE_KEY` do `.env.local`.
- Produces: org "Soren Consórcios"; usuários `admin@demo.soren.com.br` (admin), `gestor@demo.soren.com.br` (manager), `ana@demo.soren.com.br` e `bruno@demo.soren.com.br` (consultants), senha `demo12345` (apenas dev); settings iniciais; índices IGP-M/IPCA/CDI/poupança. As fases 2+ assumem esses logins nos testes E2E.

- [ ] **Step 1: Instalar dependências do script**

```bash
pnpm add -D tsx dotenv
pnpm add @supabase/supabase-js
```

Adicionar ao `package.json`: `"db:seed": "tsx scripts/seed.ts"`.

- [ ] **Step 2: Escrever `scripts/seed.ts`**

```ts
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
  const orgId =
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
    await admin.from("financial_indexes").upsert(
      {
        organization_id: orgId,
        index_code: idx.index_code,
        reference_period: period,
        annual_rate: idx.annual_rate,
        monthly_rate: Number(((1 + idx.annual_rate / 100) ** (1 / 12) - 1) * 100).toFixed(6),
        source: "Taxa projetada configurada pelo administrador",
        projected: true,
      },
      { onConflict: undefined }, // unique index cobre dedupe; erro de duplicata é aceitável em re-run
    ).then(({ error }) => {
      if (error && !error.message.includes("duplicate")) throw error;
    });
  }

  console.log("Seed concluído. Org:", orgId);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Nota: taxas do seed são valores de desenvolvimento marcados como `projected` com origem explícita — nunca hardcoded no código da aplicação.

- [ ] **Step 3: Rodar duas vezes (idempotência)**

Run: `pnpm db:seed && pnpm db:seed`
Expected: as duas execuções terminam com "Seed concluído"; sem usuários/orgs duplicados (`psql ... -c "select count(*) from public.organizations"` → 1).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts package.json pnpm-lock.yaml
git commit -m "feat: seed idempotente — org demo, 4 usuários, settings e índices financeiros

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Autenticação — clients Supabase, middleware, login/logout

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `middleware.ts` (raiz), `src/app/login/page.tsx`, `src/features/auth/actions.ts`, `src/features/auth/login-form.tsx`

**Interfaces:**
- Consumes: seed users (Task 6).
- Produces: `createBrowserSupabase()` (client components, só auth), `createServerSupabase()` (async, Server Components/Actions — usado por TODOS os repositories das fases seguintes), server actions `signIn(formData: FormData)` e `signOut()`. Rotas protegidas: tudo exceto `/login` exige sessão.

- [ ] **Step 1: Instalar `@supabase/ssr`**

```bash
pnpm add @supabase/ssr
```

- [ ] **Step 2: Criar os três clients**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          try {
            all.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component: middleware cuida do refresh
          }
        },
      },
    },
  );
}
```

`src/lib/supabase/middleware.ts` (padrão oficial `@supabase/ssr` de refresh de sessão + redirect):

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (all) => {
          all.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          all.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}
```

`middleware.ts` (raiz do projeto):

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 3: Server actions de auth**

`src/features/auth/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export async function signIn(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos" };
  redirect("/");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
```

(Instalar zod se ainda não veio: `pnpm add zod`.)

- [ ] **Step 4: Página e formulário de login**

`src/app/login/page.tsx`:

```tsx
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <LoginForm />
    </main>
  );
}
```

`src/features/auth/login-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Soren Consórcios</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Verificar manualmente**

Run: `pnpm dev` e abrir `http://localhost:3000`.
Expected: redireciona para `/login`; login com `admin@demo.soren.com.br` / `demo12345` entra e redireciona para `/`; acessar `/login` logado volta para `/`.

- [ ] **Step 6: Lint, typecheck e commit**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: autenticação Supabase — clients SSR, middleware, login/logout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Layout base — sidebar, contexto do usuário, páginas placeholder

**Files:**
- Create: `src/repositories/profiles.ts`, `src/components/app-sidebar.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/atendimento/page.tsx`, `src/app/(app)/clientes/page.tsx`, `src/app/(app)/pipeline/page.tsx`, `src/app/(app)/produtos/page.tsx`, `src/app/(app)/configuracoes/page.tsx`
- Modify: mover conteúdo de `src/app/page.tsx` para dentro do route group `(app)`; remover boilerplate do create-next-app

**Interfaces:**
- Consumes: `createServerSupabase()` (Task 7).
- Produces: `getCurrentProfile(): Promise<Profile>` em `src/repositories/profiles.ts` com `type Profile = { id: string; organizationId: string; name: string; email: string; role: "admin" | "manager" | "consultant" }` — usado por todas as páginas/actions das fases seguintes para org/papel. Navegação lateral com itens: Início, Novo atendimento, Clientes, Pipeline, Produtos, Configurações (Configurações visível só para admin/manager).

- [ ] **Step 1: Repository de perfil**

`src/repositories/profiles.ts`:

```ts
import { createServerSupabase } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "consultant";
};

/** Perfil do usuário logado. Lança erro se não autenticado (rotas já protegidas pelo middleware). */
export async function getCurrentProfile(): Promise<Profile> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, organization_id, name, email, role")
    .eq("id", user.id)
    .single();
  if (error || !data) throw new Error("Perfil não encontrado");
  return {
    id: data.id,
    organizationId: data.organization_id,
    name: data.name,
    email: data.email,
    role: data.role,
  };
}
```

- [ ] **Step 2: Sidebar e layout do grupo (app)**

`src/components/app-sidebar.tsx` — usar o componente `sidebar` do shadcn:

```tsx
import Link from "next/link";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/repositories/profiles";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/atendimento", label: "Novo atendimento" },
  { href: "/clientes", label: "Clientes" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/produtos", label: "Produtos" },
];

export function AppSidebar({ profile }: { profile: Profile }) {
  const items = profile.role === "consultant" ? NAV : [...NAV, { href: "/configuracoes", label: "Configurações" }];
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 font-semibold">Soren Consórcios</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 text-sm">
        <p className="truncate text-muted-foreground">{profile.name}</p>
        <form action={signOut}>
          <Button variant="outline" size="sm" className="w-full">Sair</Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
```

`src/app/(app)/layout.tsx`:

```tsx
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentProfile } from "@/repositories/profiles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <SidebarProvider>
      <AppSidebar profile={profile} />
      <main className="flex-1 p-6">
        <SidebarTrigger className="mb-4 md:hidden" />
        {children}
      </main>
    </SidebarProvider>
  );
}
```

- [ ] **Step 3: Páginas placeholder**

`src/app/(app)/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Início</h1>
      <p className="mt-2 text-muted-foreground">Dashboard comercial disponível na Fase 5.</p>
    </div>
  );
}
```

Criar `atendimento/page.tsx`, `clientes/page.tsx`, `pipeline/page.tsx`, `produtos/page.tsx`, `configuracoes/page.tsx` no mesmo padrão, trocando título e fase (`Novo atendimento` → "Fase 3", `Clientes` → "Fase 3", `Pipeline` → "Fase 5", `Produtos` → "Fase 2", `Configurações` → "Fase 2/4"). Remover `src/app/page.tsx` original e assets boilerplate não usados.

- [ ] **Step 4: Verificar manualmente**

Run: `pnpm dev`
Expected: após login, sidebar com navegação funciona; usuário consultant (ana@) não vê "Configurações"; botão Sair volta para `/login`.

- [ ] **Step 5: Lint, typecheck, testes e commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS.

```bash
git add -A
git commit -m "feat: layout base com sidebar, perfil do usuário e páginas placeholder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Documentação de planejamento

**Files:**
- Create: `AGENTS.md`, `PLANS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/CALCULATIONS.md`, `README.md` (substituir boilerplate)

**Interfaces:**
- Consumes: spec (`docs/superpowers/specs/2026-07-16-soren-consorcio-dashboard-design.md`) e `docs/ANALISE_PLANILHA.md`.
- Produces: documentação viva; `PLANS.md` é atualizado ao fim de CADA fase (obrigação do prompt original, seção 31).

- [ ] **Step 1: Escrever os documentos**

- `AGENTS.md`: regras para agentes trabalhando no repo — ler spec e este plano; TypeScript estrito; dinheiro nunca em float; regras de negócio só em `src/domain`; acesso a banco só via `src/repositories`; validação Zod em toda entrada de Server Action; UI neutra shadcn sem identidade visual; comandos (`pnpm dev/lint/typecheck/test/db:seed`, `pnpm supabase start/db reset`); credenciais demo; commits em português com Co-Authored-By.
- `PLANS.md`: tabela das 7 fases (conteúdo e gate, copiar da spec seção 12) + seção "Progresso" com Fase 1 detalhada task a task e status.
- `docs/ARCHITECTURE.md`: diagrama de camadas da spec (seção 5), responsabilidade de cada pasta de `src/`, decisão servidor×cliente (elegibilidade/ranking no servidor; correções no cliente com funções puras), padrão Server Actions + Zod, decisões registradas (decimal.js, NUMERIC, RLS defesa em profundidade).
- `docs/DATABASE.md`: as 11 tabelas com propósito, colunas-chave, enums, índices, padrão de RLS por papel (tabela da Task 5), convenções (NUMERIC(14,2) dinheiro, NUMERIC(6,3) percentuais em pontos, `deleted_at` para exclusão lógica de clientes).
- `docs/CALCULATIONS.md`: fórmulas da planilha (da ANALISE_PLANILHA.md) + fórmulas de correção e comparação da spec (seção 8) que serão implementadas na F4, com notação e exemplos numéricos do oráculo.
- `README.md`: objetivo, stack, pré-requisitos (Node 24+, pnpm, Docker), instalação (`pnpm install`, `pnpm supabase start`, `.env.local`, `pnpm db:seed`, `pnpm dev`), credenciais demo, comandos, estado atual (Fase 1) e roadmap das fases. Seções de deploy/importação/PDF marcadas como "disponível na Fase N" — sem conteúdo inventado.

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md PLANS.md docs/ README.md
git commit -m "docs: AGENTS, PLANS, ARCHITECTURE, DATABASE, CALCULATIONS e README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Gate da Fase 1 + push

**Files:**
- Modify: `PLANS.md` (marcar Fase 1 concluída)

**Interfaces:**
- Consumes: todas as tasks anteriores.
- Produces: Fase 1 fechada; branch `main` publicada no GitHub.

- [ ] **Step 1: Rodar o gate completo**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: tudo PASS, build sem erros.

- [ ] **Step 2: Smoke test manual final**

`pnpm dev`: login como admin e como consultora ana@; navegação completa; logout. Supabase Studio (`http://127.0.0.1:54323`): conferir 11 tabelas e RLS.

- [ ] **Step 3: Atualizar PLANS.md e commitar**

Marcar Fase 1 como concluída com data, listar o que foi entregue.

```bash
git add PLANS.md
git commit -m "docs: Fase 1 (Fundação) concluída — registro no PLANS.md

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push para o GitHub**

```bash
git push -u origin main
```

Expected: branch `main` publicada em https://github.com/kaiobaronips/Soren-consorcios-dashboard.

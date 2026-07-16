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

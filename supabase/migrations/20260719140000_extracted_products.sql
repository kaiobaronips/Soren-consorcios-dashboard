-- Fase 6 / Task 4: tabela de staging da revisão humana dos produtos extraídos do PDF.
-- Cada linha é UM produto candidato extraído de UMA página, guardado POR CAMPO
-- (value/confidence/raw) para os 7 campos + confiança geral + issues legíveis.
-- Nada aqui é publicado automaticamente: a publicação em consortium_products é
-- ação humana da Task 5 (review_status -> published + published_product_id).

create type public.extraction_review_status as enum
  ('pending_review', 'approved', 'rejected', 'published');

create table public.extracted_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  document_id uuid not null references public.product_documents (id) on delete cascade,
  page integer not null,

  -- 7 campos extraídos, cada um com valor normalizado, confiança (0–100) e texto cru.
  product_name_value text,
  product_name_confidence numeric(5,2) not null default 0,
  product_name_raw text,

  product_code_value text,
  product_code_confidence numeric(5,2) not null default 0,
  product_code_raw text,

  credit_amount_value numeric(14,2),
  credit_amount_confidence numeric(5,2) not null default 0,
  credit_amount_raw text,

  term_months_value integer,
  term_months_confidence numeric(5,2) not null default 0,
  term_months_raw text,

  total_administration_fee_percent_value numeric(6,3),
  total_administration_fee_percent_confidence numeric(5,2) not null default 0,
  total_administration_fee_percent_raw text,

  regular_installment_amount_value numeric(14,2),
  regular_installment_amount_confidence numeric(5,2) not null default 0,
  regular_installment_amount_raw text,

  first_12_installment_amount_value numeric(14,2),
  first_12_installment_amount_confidence numeric(5,2) not null default 0,
  first_12_installment_amount_raw text,

  overall_confidence numeric(5,2) not null default 0,
  issues jsonb not null default '[]',
  review_status public.extraction_review_status not null default 'pending_review',

  -- Preenchido só quando um humano publica (Task 5). FK opcional para o produto criado.
  published_product_id uuid references public.consortium_products (id) on delete set null,

  edited_by uuid references public.profiles (id),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index extracted_products_document_idx
  on public.extracted_products (document_id, review_status);
create index extracted_products_org_idx
  on public.extracted_products (organization_id);

create trigger extracted_products_updated_at before update on public.extracted_products
  for each row execute function public.set_updated_at();

-- RLS: staging só é acessível por staff (admin/manager) da própria organização.
alter table public.extracted_products enable row level security;

create policy extracted_products_staff on public.extracted_products for all
  using (organization_id = public.current_org_id() and public.is_org_staff())
  with check (organization_id = public.current_org_id() and public.is_org_staff());

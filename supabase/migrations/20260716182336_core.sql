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

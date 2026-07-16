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

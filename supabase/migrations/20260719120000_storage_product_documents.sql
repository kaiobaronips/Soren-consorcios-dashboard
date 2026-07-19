-- Fase 6 / Task 3: bucket privado + policies de storage para documentos de produto.
-- O upload é feito pelo client server-side com a sessão do usuário (não service_role),
-- portanto estas policies são a barreira real: só staff (admin/manager) da organização
-- acessa objetos sob o prefixo da própria org (`<org_id>/...`).

-- Bucket privado (idempotente).
insert into storage.buckets (id, name, public)
values ('product-documents', 'product-documents', false)
on conflict (id) do nothing;

-- storage.foldername(name)[1] é o primeiro segmento do caminho (o org_id que usamos como prefixo).
create policy product_documents_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_org_staff()
  );

create policy product_documents_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_org_staff()
  );

create policy product_documents_update on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_org_staff()
  )
  with check (
    bucket_id = 'product-documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_org_staff()
  );

create policy product_documents_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_org_staff()
  );

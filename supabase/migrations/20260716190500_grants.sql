-- 0004 grants: privilégios de tabela para anon/authenticated/service_role
-- Sem isso, PostgREST (via authenticator -> anon/authenticated/service_role) recebe
-- "permission denied" mesmo com service_role, pois GRANT é uma camada anterior ao RLS.
-- RLS continua sendo a barreira de segurança; estes GRANTs apenas permitem que as
-- policies sejam avaliadas.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

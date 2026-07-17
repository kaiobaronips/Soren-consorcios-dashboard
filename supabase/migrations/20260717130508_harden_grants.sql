-- 0005 harden grants: menor privilégio sobre a 0004.
-- anon: nenhum privilégio em tabelas/sequências/rotinas (o cliente browser só usa Auth;
--   nenhuma rota anônima lê o schema public). Mantém apenas USAGE no schema para o
--   PostgREST não falhar na introspecção.
-- authenticated: apenas SELECT/INSERT/UPDATE/DELETE (sem TRUNCATE/REFERENCES/TRIGGER);
--   RLS continua decidindo linha a linha o que cada usuário vê.
-- service_role: mantém ALL (uso exclusivo de servidor/scripts).
-- Default privileges deixam de conceder a anon; novas tabelas recebem apenas o padrão
--   restrito para authenticated.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on routines from anon;

revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all sequences in schema public from authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public revoke all on sequences from authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

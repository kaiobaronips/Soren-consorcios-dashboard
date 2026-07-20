# SECURITY.md

Modelo de ameaças e mitigações do Soren Consórcio Dashboard. Documenta o que está **implementado** hoje e o que é **roadmap** — sem otimismo: cada seção diz explicitamente o estado real do código.

## 1. Modelo de ameaças (visão geral)

Aplicação multi-tenant (várias organizações/imobiliárias de consórcio compartilham o mesmo banco) com três papéis por organização (`admin`, `manager`, `consultant`). As ameaças relevantes:

| # | Ameaça | Mitigação |
|---|---|---|
| T1 | Consultor A lê/edita clientes, simulações ou oportunidades do consultor B (mesma org) | RLS (`consultant_id = auth.uid()` ou staff) — seção 2 |
| T2 | Usuário da organização X lê/edita dados da organização Y | RLS (`organization_id = current_org_id()`) em toda tabela de negócio — seção 2 |
| T3 | Cliente HTTP forja payload de formulário (tipo errado, campos extras, valores fora de faixa) | Validação Zod server-side em toda Server Action — seção 3 |
| T4 | Acesso a rota autenticada sem sessão válida (deep link, token expirado) | `proxy.ts` + middleware Supabase SSR — seção 4 |
| T5 | Download direto de PDF de outra organização via URL do bucket | Bucket privado + RLS de `storage.objects` — seção 5 |
| T6 | Upload de arquivo malicioso disfarçado de PDF (payload executável, MIME forjado) | Validação de magic bytes + tamanho + sanitização de nome — seção 6 |
| T7 | Ação destrutiva/sensível sem rastro (quem mudou o quê e quando) | `audit_logs` — seção 7 |
| T8 | Vazamento de credenciais (chave de service role, senha de banco) no client bundle ou no repositório | Segredos só em `.env.local`/env do provedor — seção 8 |
| T9 | Escalonamento de privilégio via papel de banco (`anon`/`authenticated` executando operações fora do escopo do RLS) | Grants de menor privilégio — seção 9 |
| T10 | Exclusão física de cliente apaga histórico de simulações/oportunidades vinculado, ou expõe dado que devia ser esquecido | Exclusão lógica (`deleted_at`) — seção 10, **parcialmente implementado** |
| T11 | Tratamento de dado pessoal sem base legal/finalidade documentada (LGPD) | Seção 11 — **parcialmente implementado, resto é roadmap** |

## 2. Isolamento por organização + papel (RLS)

RLS é a barreira efetiva de autorização — habilitada em toda tabela de negócio (`clients`, `consortium_products`, `product_documents`, `simulations`, `opportunities`, `interactions`, `financial_indexes`, `system_settings`, `audit_logs`, além de `organizations`/`profiles`). Nenhuma query da aplicação filtra `organization_id` manualmente para autorização — a policy do Postgres faz isso mesmo que o código da aplicação esqueça o filtro.

Helpers `security definer` (migration `core`), usados por toda policy:
- `current_org_id()` — `organization_id` do `profiles` do usuário autenticado (`auth.uid()`).
- `current_user_role()` — `role` (`admin`/`manager`/`consultant`) do mesmo perfil.
- `is_org_staff()` — `true` se `admin` ou `manager` (migration `rls`).

### Matriz de policies

| Tabela | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `organizations` | própria organização | — | própria organização, só `admin` |
| `profiles` | própria organização | — (via seed/admin) | próprio perfil, ou `admin` (all) |
| `clients` | próprios (consultor) ou toda a org (staff) | própria organização | próprios (consultor) ou toda a org (staff) |
| `consortium_products` | toda a organização | staff | staff |
| `product_documents` | staff | staff | staff |
| `simulations` | próprias (consultor) ou toda a org (staff) | própria organização, só o próprio consultor | — |
| `opportunities` | próprias (consultor) ou toda a org (staff) | própria organização | próprios (consultor) ou toda a org (staff) |
| `interactions` | próprias (consultor) ou toda a org (staff) | própria organização, só o próprio consultor | — |
| `financial_indexes` | organização + globais (`organization_id is null`) | admin | admin |
| `system_settings` | própria organização | admin | admin |
| `audit_logs` | própria organização, só `admin` | qualquer usuário da organização | — |

Resumo: `consultant` restrito aos próprios clientes/simulações/oportunidades/interações; `admin`/`manager` (`is_org_staff()`) veem toda a organização; produtos e índices financeiros globais são de leitura ampla mas escrita restrita a staff/admin.

**Verificado por teste automatizado** (`src/repositories/rls-isolation.test.ts`, integração contra Supabase local):
- **Caso 17 — isolamento entre consultores**: ana cria um cliente; bruno (mesma org, `consultant`) não o enxerga; admin (staff, mesma org) enxerga.
- **Caso 18 — isolamento entre organizações**: usuário de uma 2ª organização (criada só para o teste) não enxerga clientes/produtos da "Soren Consórcios", e vice-versa.

Limitação conhecida: RLS não impede um `admin`/`manager` de ver todos os dados da própria organização — isso é intencional (papel de staff), não uma falha.

## 3. Validação server-side (Zod)

Toda Server Action que recebe `FormData` do cliente valida com Zod antes de tocar o banco (`src/features/*/schema.ts` + `actions.ts`), nunca confiando em validação client-side (que é só UX). Exemplos: `createClientSchema` (`src/features/clients/schema.ts`), `createProductSchema`/`toggleStatusSchema` (`src/features/products/schema.ts`), schemas equivalentes em `simulations`, `atendimento`, `base-produtos`. Falha de parse retorna erro tipado para o formulário sem nunca propagar o payload bruto para uma query.

RLS e Zod são camadas independentes: Zod garante formato/tipo/obrigatoriedade; RLS garante que a linha pertence a quem está gravando. Um payload validamente formado ainda pode ser barrado pela policy (ex.: `organization_id` não confere).

## 4. Proteção de rotas (`proxy.ts`)

`src/proxy.ts` (Next.js middleware, todas as rotas exceto assets estáticos via `matcher`) chama `updateSession()` (`src/lib/supabase/middleware.ts`), que:
- Revalida a sessão Supabase a cada requisição via `supabase.auth.getUser()` (não confia em cookie sem revalidar contra o Auth server).
- Redireciona para `/login` qualquer requisição sem usuário autenticado, exceto o próprio `/login`.
- Redireciona usuário já autenticado para fora de `/login`.

Isso cobre acesso direto por URL (deep link) e cookies expirados; a autorização fina por papel/organização continua sendo responsabilidade do RLS (seção 2), não do middleware.

## 5. Storage privado com policies

Bucket `product-documents` é privado (`public = false`, migration `20260719120000_storage_product_documents.sql`). Policies de `storage.objects` usam o primeiro segmento do path (`storage.foldername(name)[1]`) como `organization_id` — leitura/escrita/atualização/exclusão exigem `(storage.foldername(name))[1] = current_org_id()::text` **e** `is_org_staff()`. Consultor não acessa documentos de produto (nem da própria org); só staff. O upload é feito server-side com a sessão do usuário (não com `service_role`), então essas policies são a barreira real, não uma formalidade.

## 6. Upload seguro de PDF

`src/lib/pdf/upload-validation.ts`:
- **Magic bytes**: `hasPdfMagicBytes()` verifica os 5 primeiros bytes reais do conteúdo (`%PDF-`) — não confia no `Content-Type`/MIME informado pelo browser, que é trivialmente forjável.
- **Tamanho**: limite configurável via `MAX_PDF_SIZE_MB` (env).
- **Sanitização de nome**: `sanitizeFileName()` remove qualquer caractere fora de `[a-zA-Z0-9._-]`, prevenindo path traversal (`../`) e injeção de caracteres especiais no path do storage.
- **Dedup por hash**: `sha256Hex()` do conteúdo, usado como `file_hash` em `product_documents` para evitar reprocessar o mesmo arquivo.

## 7. Auditoria (`audit_logs`)

`src/repositories/audit.ts` (`logAudit()`) grava `organization_id`, `user_id`, `action`, `entity_type`, `entity_id`, `previous_state`/`new_state` (jsonb). Chamado hoje em: criação de cliente, mudança de status de produto e criação de produto (`src/features/clients/actions.ts`, `src/features/products/actions.ts`), simulações, base de produtos e atendimento. Falha de auditoria **não derruba a operação principal** — é logada no servidor (`console.error`) e a ação de negócio segue; isso é uma escolha deliberada (auditoria não deve ser um novo ponto único de falha), mas significa que a auditoria não é estritamente garantida em 100% dos casos de erro transitório do banco.

Leitura de `audit_logs` é restrita a `admin` da própria organização (policy `audit_logs_select`); qualquer usuário da organização pode inserir (a própria ação do usuário gera o registro).

**Roadmap**: nem toda mutação do sistema passa por `logAudit()` hoje (cobertura por feature, não wildcard automático) — não há trigger de banco genérico que audite todo UPDATE/DELETE.

## 8. Segredos apenas em variáveis de ambiente

`.env.local` (nunca commitado — presente em `.gitignore`) concentra: `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (públicas, seguras para o client por design — a segurança real é o RLS), `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS — usada **apenas** em scripts server-side/seed, nunca importada por código que roda no browser), `DATABASE_URL` (conexão direta ao Postgres, só scripts de migration/seed). Nenhum segredo é lido de arquivo versionado ou hardcoded no código-fonte.

## 9. Menor privilégio nos grants (migration de hardening)

`20260716190500_grants.sql` concede `GRANT ALL` amplo (padrão inicial do Supabase self-hosted) para `anon`/`authenticated`/`service_role`. `20260717130508_harden_grants.sql` reduz isso:
- `anon`: revogado tudo em tabelas/sequences/routines — mantém só `USAGE` no schema (necessário para o PostgREST não falhar na introspecção). Nenhuma rota da aplicação usa `anon` para ler dados; o client browser só fala com o Auth.
- `authenticated`: restrito a `SELECT`/`INSERT`/`UPDATE`/`DELETE` — sem `TRUNCATE`/`REFERENCES`/`TRIGGER`. RLS continua decidindo linha a linha o que cada usuário vê/grava; o grant só destrava a avaliação da policy (grant é a camada anterior ao RLS no pipeline do PostgREST — sem ele a policy nunca é avaliada).
- `service_role`: mantém `ALL` — uso exclusivo de servidor/scripts, nunca exposto ao browser.
- Default privileges espelham o mesmo padrão para tabelas futuras (uma tabela nova não nasce com grant amplo para `anon` por esquecimento).

## 10. Exclusão lógica de clientes (`deleted_at`)

**Schema**: `clients.deleted_at timestamptz` existe (migration `business`), pensado para permitir anonimização/exclusão de um cliente sem apagar o histórico de simulações/oportunidades vinculado (que referenciam `client_id`).

**Estado real no código — roadmap, não implementado**: nenhuma query da aplicação (`src/repositories/clients.ts`) filtra `deleted_at is null` hoje, e não existe nenhuma Server Action que grave em `deleted_at` (nenhum fluxo de "excluir cliente" ou "anonimizar cliente" na UI). A coluna está pronta no schema mas o comportamento de exclusão lógica **ainda não está implementado na aplicação** — é a próxima peça a fechar antes de qualquer fluxo de exclusão de cliente ir para produção. Até lá, não há forma de um consultor ou admin remover um cliente pela UI (mitiga T10 por ausência de funcionalidade, não por controle ativo).

## 11. LGPD — finalidade e consentimento

**Implementado hoje**:
- Isolamento de dados pessoais por organização e por papel (RLS, seções 2) — um consultor não acessa dados de clientes fora do seu escopo.
- Trilha de auditoria parcial (`audit_logs`, seção 7) para as ações cobertas.
- Nenhum dado pessoal de cliente é enviado para serviço de terceiros fora do próprio Supabase (sem SDK de analytics/tracking de terceiros lendo campos de `clients`).

**Roadmap (não implementado)**:
- Registro explícito de base legal/finalidade de tratamento por campo de dado pessoal (ex.: `monthly_income`, `cpf`) — hoje a finalidade é implícita (elegibilidade de crédito), não documentada por registro de consentimento.
- Fluxo de exclusão/anonimização de titular de dados a pedido (depende de T10/seção 10 estar implementado primeiro).
- Fluxo de portabilidade (exportação de dados do titular).
- Retenção/expurgo automático de dados após período definido (hoje não há job de expurgo).
- DPO/canal de contato formal para exercício de direitos do titular.

Esta seção deve ser revisada com jurídico antes de qualquer tratamento de dado pessoal em produção com clientes reais (hoje o ambiente é demo/local).

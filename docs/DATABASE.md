# DATABASE.md

Schema real do banco (Supabase/PostgreSQL), conforme as migrations em `supabase/migrations/`:

1. `20260716182336_core.sql` — `organizations`, `profiles`, helpers de RLS.
2. `20260716182819_business.sql` — as 11 tabelas de domínio, enums, índices.
3. `20260716184124_rls.sql` — políticas de RLS de todas as tabelas.
4. `20260716190500_grants.sql` — grants de tabela para `anon`/`authenticated`/`service_role`.
5. `20260717130508_harden_grants.sql` — endurecimento por menor privilégio: `anon` sem nenhum acesso a tabelas (só USAGE no schema), `authenticated` restrito a SELECT/INSERT/UPDATE/DELETE (sem TRUNCATE/REFERENCES/TRIGGER), `GRANT ALL` reservado ao `service_role`; default privileges idem para tabelas futuras.

## Convenções

- **Dinheiro:** `NUMERIC(14,2)`. Nunca `float`/`double precision`. Formatação BRL/pt-BR só na borda da UI.
- **Percentuais:** `NUMERIC(6,3)`, armazenados **em pontos percentuais**, não como fração (ex.: `26.800` representa 26,8%, não `0.268`). Vale para `total_administration_fee_percent`, `reserve_fund_percent`, `default_projected_annual_rate`, `probability_percent`.
- **Taxas de índice financeiro** (`financial_indexes.monthly_rate`/`annual_rate`): `NUMERIC(9,6)` — precisão maior por serem taxas compostas mês a mês.
- **`deleted_at timestamptz`** — exclusão lógica. Usado em `clients` para permitir anonimização/exclusão sem apagar histórico de simulações/oportunidades vinculado. Nenhuma query de aplicação deve retornar clientes com `deleted_at` preenchido, exceto telas administrativas específicas.
- **`organization_id`** presente em toda tabela de negócio (exceto `financial_indexes`, onde é opcional — `null` significa índice global compartilhado entre organizações) — é a chave de isolamento multi-tenant usada por toda policy de RLS.
- **Triggers `updated_at`** — `set_updated_at()` (definida na migration `core`) mantém `updated_at` sincronizado em `organizations`, `profiles`, `clients`, `consortium_products`, `opportunities`.
- **UUIDs** — toda chave primária é `uuid default gen_random_uuid()`.

## As 11 tabelas

### `organizations`
Tenant raiz. `name`, `document`. Toda outra tabela de negócio pendura de `organization_id`.

### `profiles`
Perfil de usuário da aplicação, 1:1 com `auth.users` (`id` referencia `auth.users.id`, `on delete cascade`). Colunas-chave: `organization_id`, `role` (enum `user_role`: `admin`/`manager`/`consultant`), `manager_id` (auto-referência opcional), `active`. Índice: `profiles_org_idx (organization_id)`.

### `clients`
Cliente/lead comercial. Colunas-chave: `organization_id`, `consultant_id` (dono do cliente), `name`, `monthly_income` (renda mensal — dado novo, não vem da planilha), `monthly_available_amount` (equivalente ao "dividendo mensal" da planilha, usado nas fórmulas de elegibilidade), `deleted_at` (exclusão lógica). Índices: `clients_org_idx`, `clients_consultant_idx`.

### `consortium_products`
Catálogo de produtos de consórcio. Colunas-chave: `category` (enum `product_category`: `property`/`vehicle`/`other`), `credit_amount`, `term_months`, `total_administration_fee_percent`, `first_installment_amount`, `first_12_installment_amount`, `regular_installment_amount`, `reserve_fund_percent`, `correction_index` (enum `correction_index`: `IGPM`/`IPCA`/`INCC`/`NONE`/`CUSTOM`), `status` (enum `product_status`: `draft`/`active`/`inactive`/`archived`), `is_demo` (produtos demonstrativos, ex.: veículos de seed), `source_document_id`/`source_page`/`extraction_confidence` (rastreabilidade de importação por PDF, Fase 6). Índices: `products_org_status_idx (organization_id, status)`, `products_eligibility_idx (organization_id, regular_installment_amount)`, e o índice único de dedup `products_dedup_idx (organization_id, product_code, category, term_months, credit_amount)` — chave usada pelo importador XLSX (Fase 2) para evitar duplicatas.

### `product_documents`
PDFs de origem de produtos (Fase 6). Colunas-chave: `file_hash` (dedup de upload), `status` (enum `document_status`: `uploaded`/`processing`/`review_required`/`completed`/`failed`), `extraction_log` (jsonb), `uploaded_by`. Índice: `product_documents_org_idx`.

### `simulations`
Snapshot imutável de uma simulação salva. Colunas-chave: `client_id`, `consultant_id`, `product_id`, `product_snapshot`/`assumptions_snapshot` (jsonb — cópia dos dados do produto e das premissas no momento da simulação, para que a simulação nunca mude retroativamente mesmo que o produto original seja editado depois), `base_credit_amount`/`projected_credit_amount`, `base_installment_amount`/`projected_installment_amount`, `projected_total_paid`, `cdi_comparison_value`. Índices: `simulations_org_idx`, `simulations_client_idx`.

### `opportunities`
Entidade de CRM/Kanban. Colunas-chave: `client_id`, `consultant_id`, `simulation_id` (opcional — origem da oportunidade), `product_id`, `stage` (enum `opportunity_stage`: `novo_lead` → `contato_realizado` → `diagnostico` → `simulacao_apresentada` → `documentacao` → `proposta` → `negociacao` → `venda_concluida` / `perdido`), `stage_entered_at`, `probability_percent`, `next_follow_up_at`, `lost_reason`, `closed_at`. Índices: `opportunities_org_stage_idx (organization_id, stage)`, `opportunities_consultant_idx`.

### `interactions`
Timeline de contato com o cliente. Colunas-chave: `client_id`, `opportunity_id` (opcional), `consultant_id`, `type` (enum `interaction_type`: `note`/`call`/`whatsapp`/`email`/`meeting`/`system`), `content`, `occurred_at`. Índice: `interactions_client_idx (client_id, occurred_at desc)`.

### `financial_indexes`
Índices econômicos (IGP-M, IPCA, CDI, poupança) por período de referência. Colunas-chave: `organization_id` (nullable — `null` = índice global), `index_code` (enum `index_code`: `IGPM`/`IPCA`/`CDI`/`SAVINGS`/`CUSTOM`), `reference_period`, `monthly_rate`/`annual_rate`, `source`/`source_url` (origem obrigatória, nunca taxa hardcoded), `projected` (taxa projetada vs. histórica). Índice único: `financial_indexes_period_idx (index_code, reference_period, coalesce(organization_id, uuid-zero))` — garante um único registro por índice/período/organização (ou global).

### `system_settings`
Configuração chave-valor por organização (regra de elegibilidade, comprometimento máximo, taxas projetadas padrão, etc.). Colunas-chave: `key`, `value` (jsonb), `updated_by`. Restrição única: `(organization_id, key)`.

### `audit_logs`
Log de auditoria (LGPD). Colunas-chave: `user_id`, `action`, `entity_type`, `entity_id`, `previous_state`/`new_state` (jsonb), `ip_address` (inet). Índice: `audit_logs_org_idx (organization_id, created_at desc)`.

## Enums

| Enum | Valores |
|---|---|
| `user_role` | `admin`, `manager`, `consultant` |
| `product_category` | `property`, `vehicle`, `other` |
| `correction_index` | `IGPM`, `IPCA`, `INCC`, `NONE`, `CUSTOM` |
| `product_status` | `draft`, `active`, `inactive`, `archived` |
| `document_status` | `uploaded`, `processing`, `review_required`, `completed`, `failed` |
| `opportunity_stage` | `novo_lead`, `contato_realizado`, `diagnostico`, `simulacao_apresentada`, `documentacao`, `proposta`, `negociacao`, `venda_concluida`, `perdido` |
| `interaction_type` | `note`, `call`, `whatsapp`, `email`, `meeting`, `system` |
| `index_code` | `IGPM`, `IPCA`, `CDI`, `SAVINGS`, `CUSTOM` |

## Padrão de RLS por papel

Todas as tabelas de negócio (as 9 abaixo de `organizations`/`profiles`) têm RLS habilitado. Helpers usados por toda policy (`security definer`, migration `core`):

- `current_org_id()` — organização do usuário autenticado.
- `current_user_role()` — papel do usuário autenticado.
- `is_org_staff()` — `true` se `admin` ou `manager` (migration `rls`).

| Tabela | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `organizations` | própria organização | — | própria organização, só `admin` |
| `profiles` | própria organização | — (via seed/admin) | próprio perfil, ou `admin` (all) |
| `clients` | próprios (consultor) ou toda a org (staff) | própria organização | próprios (consultor) ou toda a org (staff) |
| `consortium_products` | toda a organização | staff | staff |
| `product_documents` | staff | staff | staff |
| `simulations` | próprias (consultor) ou toda a org (staff) | própria organização, só o próprio consultor | — |
| `opportunities` | próprias (consultor) ou toda a org (staff) | própria organização | próprias (consultor) ou toda a org (staff) |
| `interactions` | próprias (consultor) ou toda a org (staff) | própria organização, só o próprio consultor | — |
| `financial_indexes` | organização + globais (`organization_id is null`) | admin | admin |
| `system_settings` | própria organização | admin | admin |
| `audit_logs` | própria organização, só `admin` | qualquer usuário da organização | — |

Resumo do papel `consultant`: restrito aos próprios clientes/simulações/oportunidades/interações. Papéis `admin`/`manager` (`is_org_staff()`) veem toda a organização. Produtos e índices financeiros globais são de leitura ampla (toda a org), mas escrita restrita a staff/admin.

## Grants (migration 4)

`20260716190500_grants.sql` concede `USAGE` no schema `public` e `GRANT ALL` em tabelas/sequences/routines para os papéis `anon`, `authenticated` e `service_role` — padrão do Supabase self-hosted. `GRANT` é uma camada **anterior** ao RLS no pipeline do PostgREST: sem ela, uma policy de RLS nunca chega a ser avaliada e a API retorna "permission denied" mesmo para `service_role`. O RLS continua sendo a barreira de segurança efetiva — o `GRANT` amplo apenas destrava a avaliação das policies; quem decide quais linhas cada requisição enxerga continua sendo a política de RLS de cada tabela.

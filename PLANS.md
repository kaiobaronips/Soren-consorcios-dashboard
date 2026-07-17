# PLANS.md

Plano de execução do Soren Consórcio Dashboard, por fases. Fonte: `docs/superpowers/specs/2026-07-16-soren-consorcio-dashboard-design.md` (seção 12). Este documento é atualizado ao final de **cada fase** (obrigação do prompt original, seção 31), com push para `main`.

## Fases

| Fase | Conteúdo | Gate |
|---|---|---|
| 1 Fundação | Análise da planilha (`ANALISE_PLANILHA.md`), scaffold, Supabase local, migrations, auth, perfis, RLS, layout base, docs de planejamento (`AGENTS.md`, `PLANS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `CALCULATIONS.md`) | lint+typecheck+test |
| 2 Produtos | CRUD, importador XLSX idempotente, listagem, filtros, ativação | idem + oráculo planilha |
| 3 Atendimento | Clientes, busca, Novo atendimento, elegibilidade, ranking, cards | idem |
| 4 Simulador | IGP-M/IPCA/CDI, sliders, gráficos, premissas, cenários, snapshots, resumo imprimível | idem |
| 5 CRM | Oportunidades, Kanban, interações, follow-ups, dashboard | idem + E2E |
| 6 PDF | Upload, extração, OCR, revisão, publicação, versionamento | idem + E2E |
| 7 Qualidade | Testes completos, segurança, responsividade, performance, README/docs, build final | todos os critérios de aceite (seção 32 do prompt) |

Fluxo por task: agente **Sonnet 5** implementa → **Fable 5** revisa o diff e corrige → testes → commit. `PLANS.md` é atualizado e há push para o GitHub ao fim de cada fase (branch `main`).

---

## Progresso

### Fase 1 — Fundação ✅ Concluída em 2026-07-17

| # | Task | Status |
|---|---|---|
| 1 | Scaffold Next.js + TypeScript estrito + Tailwind + shadcn/ui + Vitest | ✅ Concluída |
| 2 | `docs/ANALISE_PLANILHA.md` — engenharia reversa das fórmulas da planilha | ✅ Concluída |
| 3 | Supabase local (Docker/CLI) + migration `core` (organizations, profiles, helpers de RLS) | ✅ Concluída |
| 4 | Migration `business` — 11 tabelas de domínio, enums, índices | ✅ Concluída |
| 5 | Migration `rls` — isolamento por organização e por consultor em todas as tabelas | ✅ Concluída |
| 6 | Seed idempotente (`pnpm db:seed`) — organização demo, 4 usuários, índices financeiros | ✅ Concluída |
| 7 | Autenticação Supabase — clients SSR (`src/lib/supabase`), `src/proxy.ts`, login/logout | ✅ Concluída |
| 8 | Layout base — sidebar, perfil do usuário, páginas placeholder das telas principais | ✅ Concluída |
| 9 | Documentação de planejamento — `AGENTS.md`, `PLANS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/CALCULATIONS.md`, `README.md` | ✅ Concluída |
| 10 | Gate da Fase 1 — `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes, smoke test manual, push para `main` | ✅ Concluída |

**Entregue na Fase 1:**
- Scaffold Next.js 16 (Turbopack) + TypeScript estrito + Tailwind + shadcn/ui (`@base-ui/react`) + Vitest.
- `docs/ANALISE_PLANILHA.md` com a engenharia reversa completa das fórmulas da planilha de referência.
- Supabase local via CLI/Docker com 4 migrations (`core`, `business`, `rls`, `grants`), totalizando 11 tabelas de domínio no schema `public`, todas com RLS habilitado e isolamento por organização/consultor.
- Seed idempotente (`pnpm db:seed`): organização demo, 4 usuários (admin, gestor, 2 consultoras), settings e índices econômicos.
- Autenticação Supabase SSR (`src/lib/supabase`), proteção de rotas via `src/proxy.ts`, fluxo de login/logout.
- Layout base autenticado: sidebar com navegação condicionada ao papel do usuário, perfil do usuário, páginas placeholder das telas principais (`/`, `/atendimento`, `/clientes`, `/pipeline`, `/produtos`, `/configuracoes`).
- Documentação de planejamento completa: `AGENTS.md`, `PLANS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/CALCULATIONS.md`, `README.md`.
- Gate final: `pnpm lint`, `pnpm typecheck`, `pnpm test` (3/3) e `pnpm build` — todos verdes sem necessidade de correções. Smoke test manual confirmou: redirect `/` → `/login` sem sessão, login funcional para `admin@demo.soren.com.br` e `ana@demo.soren.com.br` (senha `demo12345`), visibilidade de "Configurações" restrita ao admin (consultora não vê o item), 11 tabelas no schema `public` com `rowsecurity = true` no Supabase Studio.

**Desvios notáveis registrados durante a Fase 1:**
- **Portas +10**: as portas padrão do Supabase local (54321/54322/54323...) conflitavam com outro projeto na máquina de desenvolvimento. Todas as portas foram remapeadas em `supabase/config.toml` com um deslocamento de `+10` (API `54331`, DB `54332`, Studio `54333`, Inbucket `54334`, Analytics `54337`) — documentado em `docs/ARCHITECTURE.md` e `README.md`.
- **`src/proxy.ts`**: a proteção de rotas ficou centralizada neste arquivo (equivalente ao `middleware.ts` do Next.js) em vez de um middleware convencional, conforme convenção adotada na Task 7.
- **Migration de grants**: PostgREST (via role `authenticator` → `anon`/`authenticated`/`service_role`) retornava "permission denied" mesmo com `service_role`, porque `GRANT` é uma camada avaliada antes do RLS. Foi necessário criar uma quarta migration (`20260716190500_grants.sql`) concedendo privilégios de tabela/sequência/rotina a `anon`, `authenticated` e `service_role` no schema `public`, incluindo `alter default privileges` para tabelas futuras. O RLS continua sendo a barreira de segurança; os grants apenas permitem que as policies sejam avaliadas.

### Fases 2–7

Ainda não iniciadas. Serão detalhadas task a task neste mesmo formato à medida que cada fase for planejada e executada.

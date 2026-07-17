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

### Fase 1 — Fundação (em andamento)

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
| 9 | Documentação de planejamento — `AGENTS.md`, `PLANS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/CALCULATIONS.md`, `README.md` | ⏳ Em andamento (esta task) |
| 10 | Gate da Fase 1 — `pnpm lint && pnpm typecheck && pnpm test` verdes + push para `main` | ⬜ Pendente |

Observação: durante a Task 3, as portas padrão do Supabase local (54321/54322/54323...) conflitavam com outro projeto na máquina de desenvolvimento. Todas as portas foram remapeadas em `supabase/config.toml` com um deslocamento de `+10` (API `54331`, DB `54332`, Studio `54333`, etc.) — documentado em `docs/ARCHITECTURE.md` e `README.md`.

### Fases 2–7

Ainda não iniciadas. Serão detalhadas task a task neste mesmo formato à medida que cada fase for planejada e executada.

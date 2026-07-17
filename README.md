# Soren Consórcio Dashboard

Sistema web comercial para venda de consórcios. Um consultor informa nome do cliente, renda mensal e valor disponível mensal durante o atendimento e recebe planos elegíveis ranqueados, simulação de reajustes (IGP-M/IPCA), comparação com investimentos (CDI/poupança), salvamento de simulações (snapshot imutável) e criação de oportunidades em um CRM com Kanban e dashboard comercial.

A lógica de negócio é derivada por engenharia reversa da planilha de referência (`references/consorcio.xlsx`), documentada em `docs/ANALISE_PLANILHA.md`; após a importação dos dados, o sistema depende apenas do banco.

Documentação completa: `AGENTS.md` (regras para agentes), `PLANS.md` (fases e progresso), `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/CALCULATIONS.md`.

## Stack

Next.js (App Router) · React · TypeScript estrito · Tailwind CSS · shadcn/ui (`@base-ui/react`) · Supabase (PostgreSQL, Auth, Storage, RLS) · Zod · `decimal.js` · Vitest · pnpm.

Dependências adicionais previstas para fases futuras (ainda não instaladas): React Hook Form, Recharts, SheetJS (`xlsx`), `pdfjs-dist` + `tesseract.js` (Fase 6), Playwright.

## Pré-requisitos

- Node 24+
- pnpm
- Docker (necessário para o Supabase local)

## Instalação

```bash
pnpm install

# Sobe o Supabase local (Postgres + Auth + Storage + Studio via Docker)
pnpm supabase start

# Copie o exemplo e preencha com as chaves impressas pelo comando acima
cp .env.example .env.local

# Popula o banco com dados de desenvolvimento (idempotente)
pnpm db:seed

# Servidor de desenvolvimento
pnpm dev
```

Aplicação em `http://localhost:3000`.

### Portas do Supabase local

As portas padrão do Supabase CLI (54321 em diante) foram remapeadas com deslocamento **+10** em `supabase/config.toml` para evitar conflito com outro projeto na máquina de desenvolvimento:

| Serviço | Porta |
|---|---|
| API (PostgREST/Auth/Storage) | `54331` |
| Postgres | `54332` |
| Studio | `54333` |

`NEXT_PUBLIC_SUPABASE_URL` em `.env.local` deve apontar para `http://127.0.0.1:54331`.

## Credenciais demo (seed)

Senha para todos: `demo12345`

| E-mail | Papel |
|---|---|
| `admin@demo.soren.com.br` | admin |
| `gestor@demo.soren.com.br` | manager |
| `ana@demo.soren.com.br` | consultant |
| `bruno@demo.soren.com.br` | consultant |

## Comandos

```bash
pnpm dev                 # servidor de desenvolvimento
pnpm build                 # build de produção
pnpm lint                  # ESLint
pnpm typecheck              # tsc --noEmit
pnpm test                    # Vitest (unitários)
pnpm test:watch               # Vitest em modo watch
pnpm db:seed                   # roda scripts/seed.ts (idempotente)

pnpm supabase start             # sobe o Supabase local
pnpm supabase stop                # derruba o Supabase local
pnpm supabase db reset              # reaplica todas as migrations + seed do zero
```

## Estado atual: Fase 1 — Fundação (em andamento)

Concluído até aqui: scaffold do projeto, análise da planilha de referência, Supabase local com migrations (schema completo das 11 tabelas, RLS, grants), seed de desenvolvimento, autenticação (login/logout via Supabase Auth, proteção de rotas por `src/proxy.ts`), layout base com sidebar e páginas placeholder das telas principais, e esta documentação. Ver `PLANS.md` para o detalhamento task a task.

Ainda não implementado: qualquer regra de negócio de elegibilidade/ranking/simulação em código (especificada em `docs/CALCULATIONS.md`, a ser implementada nas Fases 2–4), CRUD de produtos/clientes/oportunidades, dashboard comercial, upload/extração de PDF.

## Roadmap de fases

| Fase | Conteúdo |
|---|---|
| 1 Fundação | Análise da planilha, scaffold, Supabase local, migrations, auth, perfis, RLS, layout base, docs de planejamento — **em andamento** |
| 2 Produtos | CRUD de produtos, importador XLSX idempotente, listagem, filtros, ativação — disponível na Fase 2 |
| 3 Atendimento | Cadastro/busca de clientes, tela "Novo atendimento", elegibilidade, ranking, cards de resultado — disponível na Fase 3 |
| 4 Simulador | Correção IGP-M/IPCA/CDI, sliders, gráficos, premissas, cenários, snapshots de simulação, resumo imprimível — disponível na Fase 4 |
| 5 CRM | Oportunidades, Kanban, interações, follow-ups, dashboard comercial — disponível na Fase 5 |
| 6 PDF | Upload de PDFs de produtos, extração, OCR, revisão humana, publicação, versionamento — disponível na Fase 6 |
| 7 Qualidade | Testes completos (unitários + E2E), segurança, responsividade, performance, build final — disponível na Fase 7 |

Detalhamento e status atualizado em `PLANS.md`.

## Deploy

Não executado neste ciclo. O plano é rodar localmente (`pnpm dev`) durante todo o desenvolvimento; documentação de deploy para Vercel (`docs/DEPLOYMENT.md`) será escrita e o deploy realizado apenas na Fase 7 — disponível na Fase 7.

## Importação de dados (XLSX)

Importador `pnpm import:xlsx references/consorcio.xlsx` — idempotente, dedup por `product_code + category + term_months + credit_amount`, com relatório de inseridos/atualizados/ignorados/inválidos/erros — disponível na Fase 2. Ver `docs/ANALISE_PLANILHA.md` para o mapeamento completo planilha → banco.

## Geração de PDF / resumo imprimível

Resumo de simulação como página print-friendly do navegador (sem dependência de biblioteca de PDF) — disponível na Fase 4. Upload e extração de PDFs de produtos (com OCR de fallback) — disponível na Fase 6.

## Segurança e LGPD

RLS em todas as tabelas de negócio (ver `docs/DATABASE.md`), validação Zod em toda entrada de Server Action, proteção de rotas por sessão via `src/proxy.ts`, `audit_logs` para rastreabilidade, exclusão lógica de clientes (`deleted_at`), segredos apenas em variáveis de ambiente (nunca commitadas). Detalhamento em `docs/ARCHITECTURE.md`.

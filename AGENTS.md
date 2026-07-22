# AGENTS.md

Regras para qualquer agente (Sonnet 5 na produção das tasks, Fable 5 na revisão) que trabalhe neste repositório.

## Antes de codar

1. Leia a spec de design: `docs/superpowers/specs/2026-07-16-soren-consorcio-dashboard-design.md`.
2. Leia `docs/DESIGN_SYSTEM.md` — ele é a fonte da verdade visual atual do dashboard operacional.
3. Leia `PLANS.md` — encontre a fase e a task atual, e o que já foi concluído.
4. Se a task envolver fórmulas de negócio, leia `docs/ANALISE_PLANILHA.md` e `docs/CALCULATIONS.md` — eles são a fonte da verdade, não invente regra nova.

## Regras de código (obrigatórias)

- **TypeScript estrito.** Sem `any` implícito, sem `// @ts-ignore` para contornar erro real. `pnpm typecheck` tem que passar limpo.
- **Dinheiro nunca em float binário.** Persistência: `NUMERIC(14,2)` no Postgres. Em código: `decimal.js`. Formatação `pt-BR`/BRL/`America/Sao_Paulo` só na borda da UI (nunca no domínio ou nos repositories).
- **Regras de negócio só em `src/domain`.** Funções puras, zero dependência de React/Next/Supabase. Elegibilidade, ranking e cálculos financeiros vivem ali e em nenhum outro lugar (nem em componentes, nem em Server Actions).
- **Acesso a banco só via `src/repositories`.** Nenhuma outra camada (`app`, `features`, `services`, `domain`) importa o client do Supabase para consultar/gravar dados. `services/` orquestra casos de uso chamando `repositories/`; `app/` só chama `services/` (ou `features/`) via Server Actions.
- **Validação Zod em toda entrada de Server Action.** Nenhum dado do cliente chega em `services`/`repositories` sem passar por um schema Zod primeiro.
- **Design system enterprise obrigatório.** Novas telas e componentes devem seguir `docs/DESIGN_SYSTEM.md`, reutilizando `OperationalShell`, `OperationalPageHeader`, `enterprise-card`, `enterprise-table`, `enterprise-modal`, `enterprise-button` e os tokens enterprise em `src/app/globals.css`. Não crie paletas, sombras, modais, tabelas ou botões fora do padrão sem aprovação explícita.
- **Nenhuma taxa financeira hardcoded.** Taxas administrativas, fundo de reserva, índices de correção (IGP-M/IPCA/CDI/poupança) e parâmetros de elegibilidade vêm de `consortium_products`, `financial_indexes` ou `system_settings` — sempre com origem e data.
- **RLS é defesa em profundidade, não a única barreira.** Toda tabela de negócio tem RLS; além disso, `repositories/` deve filtrar explicitamente por `organization_id`/`consultant_id` quando aplicável — nunca confiar apenas na policy.

## Comandos

```bash
pnpm dev                # servidor de desenvolvimento (http://localhost:3000)
pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit
pnpm test                # Vitest (unitários)
pnpm build                # build de produção

pnpm supabase start       # sobe Supabase local (Docker) — API :54331, DB :54332, Studio :54333
pnpm supabase db reset    # reaplica todas as migrations + seed do zero
pnpm db:seed               # roda scripts/seed.ts (idempotente) sem resetar o banco
```

Pré-requisitos: Node 24+, pnpm, Docker (para o Supabase local).

## Credenciais demo (ambiente local, seed)

Senha para todas: `demo12345`

| E-mail | Papel |
|---|---|
| `admin@demo.soren.com.br` | admin |
| `gestor@demo.soren.com.br` | manager |
| `ana@demo.soren.com.br` | consultant |
| `bruno@demo.soren.com.br` | consultant |

## Testes e gate por fase

`pnpm lint && pnpm typecheck && pnpm test` precisam passar antes de avançar de task/fase (a partir da Fase 5, também `pnpm test:e2e` e `pnpm build`). Fórmulas de negócio novas ou alteradas devem ganhar um teste-oráculo contra os valores reais de `docs/ANALISE_PLANILHA.md` quando aplicável.

## Commits

Mensagens em português, formato convencional (`feat:`, `fix:`, `docs:`, `chore:`, `test:`...), descrevendo o que a task entregou. Toda mensagem termina com:

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

Nunca usar `--no-verify`, `--amend` (a menos que pedido explicitamente) ou commits vazios. `PLANS.md` é atualizado ao final de cada fase, com push para `main`.

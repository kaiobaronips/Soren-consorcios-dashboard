# ARCHITECTURE.md

Arquitetura do Soren Consórcio Dashboard — Abordagem A: server-first com domínio puro (spec, seção 5).

## Diagrama de camadas

```
Browser (React)
  │  supabase-js: apenas autenticação
  │  sliders/simulador: funções puras de src/domain (sem rede)
  ▼
Next.js App Router — Server Components + Server Actions (validação Zod em toda entrada)
  ▼
services/   (orquestração de casos de uso: simular, criar oportunidade, importar…)
  ▼
repositories/ (única camada que acessa o banco, via supabase server client)
  ▼
Supabase: PostgreSQL + Auth + Storage + RLS (defesa em profundidade, não única barreira)
```

Regra de dependência: cada camada só pode chamar a camada imediatamente abaixo. `app/` nunca importa `repositories/` diretamente; `domain/` nunca importa nada das camadas acima dele (é a camada mais interna e mais estável).

## Responsabilidade de cada pasta de `src/`

```
src/
  app/            # rotas, layouts, páginas (finas)
  components/     # UI compartilhada (shadcn)
  features/       # auth, clients, products, imports, simulations,
                  # opportunities, dashboard, financial-indexes
  domain/         # eligibility/, recommendation/, financial-calculations/
                  # funções puras, decimal.js, ZERO dependência de React/Supabase
  services/
  repositories/
  lib/
  types/
```

- **`app/`** — rotas do App Router. Páginas e layouts finos: buscam dados chamando `services/` (via Server Component ou Server Action) e delegam toda a lógica visual a `components/`/`features/`. Não contém regra de negócio nem acesso a banco.
- **`components/`** — componentes de UI compartilhados, principalmente os gerados pelo shadcn/ui (`components/ui/*`) e composições genéricas (`app-sidebar.tsx`). Sem conhecimento de domínio.
- **`features/`** — UI e lógica de apresentação específicas de um domínio funcional (ex.: `features/auth` já existe com `actions.ts` + `login-form.tsx`). Cada feature futura (`clients`, `products`, `imports`, `simulations`, `opportunities`, `dashboard`, `financial-indexes`) recebe sua própria pasta. Uma feature pode chamar `services/` diretamente via Server Action; nunca chama `repositories/` ou o client Supabase para dados de negócio.
- **`domain/`** — o coração do sistema: elegibilidade (`eligibility/`), ranking (`recommendation/`) e cálculos financeiros (`financial-calculations/`). Funções puras, determinísticas, testáveis sem mocks, usando `decimal.js` para toda operação monetária/percentual. Zero import de React, Next ou Supabase — é por isso que as mesmas funções rodam no servidor (elegibilidade/ranking) e no cliente (correção de índices, sliders).
- **`services/`** — orquestração de casos de uso (ex.: simular um plano, criar uma oportunidade a partir de uma simulação, importar produtos de uma planilha). Combina chamadas a `repositories/` com funções de `domain/`; é onde a lógica de "o que fazer" mora, sem saber "como persistir".
- **`repositories/`** — única camada autorizada a falar com o Supabase para dados de negócio (hoje: `repositories/profiles.ts`). Usa sempre o client server-side (`src/lib/supabase/server.ts`), nunca o client de browser, e filtra explicitamente por `organization_id`/`consultant_id` como defesa em profundidade além do RLS.
- **`lib/`** — utilitários técnicos transversais: clients Supabase (`lib/supabase/client.ts`, `server.ts`, `middleware.ts`), formatação (`lib/format.ts`), helpers genéricos (`lib/utils.ts`). Sem regra de negócio.
- **`types/`** — tipos TypeScript compartilhados entre camadas (ainda vazio na Fase 1; populado conforme as entidades de domínio ganham tipos próprios).

## Decisão servidor × cliente

- **Elegibilidade e ranking são calculados no servidor.** `getEligibleProducts`, `calculateIncomeCommitment`, `rankConsortiumProducts` rodam em Server Components/Server Actions, usando dados vindos de `repositories/`. Isso garante que o resultado seja auditável e consistente — o mesmo cálculo que gerou o resumo do consultor é o que fica gravado no snapshot da simulação.
- **Correção de índices (IGP-M/IPCA/CDI) e comparações são calculadas no cliente**, pelas mesmas funções puras de `src/domain` (não uma reimplementação em JS solto). O objetivo é resposta instantânea ao mover um slider, sem round-trip ao servidor a cada mudança de ano/taxa. Como `domain/` não depende de Supabase nem de Node-only APIs, as funções podem ser importadas tanto em Server Actions quanto em Client Components sem duplicação de lógica.
- Consequência prática: nenhuma fórmula financeira deve ser escrita duas vezes (uma para o servidor, outra para o cliente) — sempre a mesma função de `domain/`, importada dos dois lados.

## Proteção de rotas: `src/proxy.ts`

O Next.js 16 substituiu o antigo `middleware.ts` por uma função `proxy` exportada de `src/proxy.ts`. Neste projeto, `src/proxy.ts` delega para `updateSession()` em `src/lib/supabase/middleware.ts`, que:

- Atualiza a sessão Supabase (refresh de cookies) a cada requisição.
- Aplica o matcher configurado (`config.matcher`) para rodar em todas as rotas, exceto assets estáticos (`_next/static`, `_next/image`, `favicon.ico`, imagens).

Toda a proteção de rota por sessão/papel passa por este arquivo — não existe (e não deve ser criado) um `middleware.ts` na raiz do projeto; no Next 16, esse é o caminho legado e não é mais o mecanismo suportado.

## Padrão Server Actions + Zod

Toda Server Action que recebe dados do cliente (formulários, filtros, ações de UI) segue o padrão:

1. Receber o `FormData`/objeto bruto.
2. Validar com um schema Zod específico da ação — nenhum dado não validado passa adiante.
3. Em caso de erro de validação, retornar erros de campo para a UI (sem lançar exceção genérica).
4. Chamar `services/` (nunca `repositories/` diretamente) com os dados já validados e tipados.

Exemplo já implementado: `src/features/auth/actions.ts` (login) segue esse padrão com o client Supabase server-side.

## Decisões registradas

- **`decimal.js` para todo cálculo financeiro no domínio.** Ponto flutuante binário (`number` do JS) não é aceitável para dinheiro/percentuais — a própria planilha original já demonstra resíduos de ponto flutuante (`docs/ANALISE_PLANILHA.md`, seção 5). `decimal.js` evita esse problema tanto no servidor quanto no cliente.
- **`NUMERIC` no Postgres para todo valor monetário/percentual**, nunca `float`/`double precision` ou `int` escalado manualmente. Ver `docs/DATABASE.md` para as convenções de escala (`NUMERIC(14,2)` para dinheiro, `NUMERIC(6,3)` para percentuais em pontos).
- **RLS como defesa em profundidade, não única barreira.** Toda tabela de negócio tem Row Level Security habilitado e políticas por `organization_id`/papel (`docs/DATABASE.md`). Além disso: (a) `repositories/` filtra explicitamente por organização/consultor nas queries, não depende só da policy; (b) uma migration de **grants** (`20260716190500_grants.sql`) concede privilégios de tabela a `anon`/`authenticated`/`service_role` — isso é uma camada *anterior* ao RLS no Postgres/PostgREST (sem `GRANT`, a policy nunca chega a ser avaliada, resultando em "permission denied" mesmo com `service_role`); o `GRANT` amplo não enfraquece a segurança porque o RLS continua sendo a barreira que decide quais linhas cada papel de aplicação enxerga.
- **UI neutra shadcn/ui, sem identidade visual própria** até a sessão de definição visual com o usuário (spec, seção 2). O projeto usa `@base-ui/react` (dependência atual do shadcn/ui) como base de acessibilidade dos componentes primitivos — nas versões atuais do shadcn, composição de comportamento (ex.: renderizar um componente como outro elemento) usa a prop `render`, não o padrão antigo `asChild`.

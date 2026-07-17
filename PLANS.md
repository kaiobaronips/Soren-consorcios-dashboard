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

### Fase 2 — Produtos ✅ Concluída em 2026-07-17

| # | Task | Status |
|---|---|---|
| 1 | Normalização de valores monetários e percentuais com `decimal.js` (`toMoneyString`, `fractionToPercentPoints`) | ✅ Concluída |
| 2 | Parser XLSX da aba Consórcios com ExcelJS + testes-oráculo (63 produtos) | ✅ Concluída |
| 3 | Plano de importação puro com dedup e idempotência (`product_code + category + term_months + credit_amount`) | ✅ Concluída |
| 4 | Script `pnpm import:xlsx` idempotente com relatório (inseridos/atualizados/ignorados/inválidos/erros) + produtos demo de veículo + fix seed | ✅ Concluída |
| 5 | Repository/actions de produtos com Zod e auditoria (`src/repositories/products.ts`) | ✅ Concluída |
| 6 | Página `/produtos` — listagem, filtros, cadastro manual, ativar/inativar | ✅ Concluída |
| 7 | Gate da Fase 2 — fix de revisão (sanitização do filtro de busca + teste de normalização NUMERIC), `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes, 3ª execução idempotente do importador, push para `main` | ✅ Concluída |

**Entregue na Fase 2:**
- Normalização decimal-safe de valores da planilha (`src/lib/xlsx/normalize.ts`) evitando erro de float em conversões monetárias/percentuais.
- Parser da aba "Consórcios" do `references/consorcio.xlsx` (`src/lib/xlsx/parse-consorcio.ts`) com testes-oráculo cobrindo os 63 produtos reais da planilha.
- Plano de importação puro (`src/lib/xlsx/import-plan.ts`) que compara planilha vs. banco e decide inserir/atualizar/ignorar por chave de negócio, sem efeitos colaterais — idempotência garantida por design, testada com múltiplas execuções.
- Script `scripts/import-xlsx.ts` (`pnpm import:xlsx <arquivo>`) que aplica o plano contra o Supabase local e imprime relatório; produtos demo de veículo (`is_demo=true`) inseridos via seed para completar o catálogo de teste.
- Repository de produtos (`src/repositories/products.ts`) com normalização NUMERIC→string via `decimal.js` (PostgREST retorna `number`, perdendo zeros à direita), Server Actions de cadastro manual e ativação/inativação validadas com Zod, e sanitização do filtro de busca livre (remoção de `,`/`()` antes de montar o `.or(...ilike...)` do PostgREST) para evitar quebra de sintaxe do filtro.
- Página `/produtos`: listagem com filtros (categoria, status, busca), formulário de cadastro manual, toggle ativar/inativar.
- Teste unitário de `toProduct` cobrindo os três casos de normalização (valor inteiro, fração percentual, `null`) sem dependência de banco.
- Gate final: `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` verdes. Verificação de idempotência: 3ª execução consecutiva de `pnpm import:xlsx references/consorcio.xlsx` produziu `Inseridos: 0 / Ignorados: 63`, com contagens no banco inalteradas (`property/is_demo=false` = 63, `vehicle/is_demo=true` = 8).

**Desvios notáveis registrados durante a Fase 2:**
- **Revisão Fable 5**: dois findings *Minor* corrigidos em commit separado antes do gate final — (a) `toProduct` exportada e testada isoladamente (não exigia banco); (b) filtro `search` de `listProducts` sanitizado contra `,`/`()`, que quebravam a sintaxe do `.or(...)` do PostgREST.

### Fase 3 — Atendimento ✅ Concluída em 2026-07-17

| # | Task | Status |
|---|---|---|
| 1 | Domínio de elegibilidade — classificação (`compatible`/`attention`/`incompatible`), `basis` configurável (`regular`/`first`/`max`), folga e comprometimento de renda decimal-safe | ✅ Concluída |
| 2 | Resumo de elegibilidade (`summarizeEligibility`) validado pelo oráculo dos 4 clientes reais da planilha (João Silva, Maria Souza, Carlos Pereira, JANDIRINHA) | ✅ Concluída |
| 3 | Ranking determinístico e explicável (`rankConsortiumProducts`) com `reasons` somando o score e `highlights` (maior carta, menor parcela, menor prazo, menor taxa, melhor equilíbrio) | ✅ Concluída |
| 4 | Repository e Server Actions de clientes com busca incremental e normalização NUMERIC→string | ✅ Concluída |
| 5 | Página `/clientes` — cadastro e lista filtrada por papel (RLS: consultor vê só os seus) | ✅ Concluída |
| 6 | Service de atendimento (`src/services/atendimento.ts`) — orquestra produtos ativos + settings da organização, regra de `basis` configurável e alerta de risco por comprometimento de renda | ✅ Concluída |
| 7 | Tela "Novo atendimento" — resumo de elegibilidade, cards ranqueados com motivos, alerta de risco | ✅ Concluída |
| 8 | Gate da Fase 3 — fix de revisão (teste de normalização NUMERIC do repository de clientes), `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes, push para `main` | ✅ Concluída |

**Entregue na Fase 3:**
- Domínio de elegibilidade (`src/domain/eligibility`) puro e sem I/O: `classifyProduct` (parcela igual ao disponível é inclusiva/compatível; acima é incompatível; recorrente cabe mas 1ª–12ª estoura vira `attention`, nunca escondido), `isEligible`/`getEligibleProducts` parametrizados por `basis` (`regular`/`first`/`max`), `calculateMonthlySlack` e `calculateIncomeCommitment` com precisão decimal (`decimal.js`).
- `summarizeEligibility` (`src/domain/eligibility/summary.ts`) agregando maior carta pagável, menor/maior parcela compatível, melhor folga e comprometimento máximo — validado contra o oráculo dos 4 clientes publicados na planilha de referência (João Silva, Maria Souza, Carlos Pereira, JANDIRINHA), incluindo os valores de menor/maior parcela da aba Dashboard.
- Ranking (`src/domain/recommendation`) determinístico: score somado a partir de `reasons` explicáveis (categoria desejada, prazo desejado, classificação, folga, carta), `highlights` de destaque por critério, e empate resolvido de forma estável (mesma entrada produz sempre a mesma ordem).
- Repository de clientes (`src/repositories/clients.ts`) com `toClient` pura exportada normalizando NUMERIC→string via `decimal.js` (mesma técnica de `products.ts`), busca incremental sanitizada e Server Actions de CRUD.
- Página `/clientes`: cadastro e lista, com RLS restringindo consultor aos seus próprios clientes.
- Service de atendimento (`src/services/atendimento.ts`): orquestra produtos ativos filtrados por categoria desejada + settings da organização (`eligibilityBasis`, `maxIncomeCommitmentPercent`), calcula elegibilidade/ranking/resumo e emite `riskAlert` quando o comprometimento de renda ultrapassa o teto configurado.
- Tela `/atendimento` ("Novo atendimento"): formulário de cliente/valores, resumo de elegibilidade, cards de produtos ranqueados com motivos do score e alerta de risco visível quando aplicável.
- Teste unitário de `toClient` cobrindo os três casos de normalização (valor inteiro, `null`), fechando o finding *Minor* pendente da revisão da Fase 2/Task 4.
- Gate final: `pnpm lint`, `pnpm typecheck`, `pnpm test` (todos os casos obrigatórios do prompt §10/§5 cobertos — ver mapeamento no relatório da Task 8) e `pnpm build` verdes.

### Fases 4–7

Ainda não iniciadas. Serão detalhadas task a task neste mesmo formato à medida que cada fase for planejada e executada.

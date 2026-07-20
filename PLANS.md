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

### Fase 4 — Simulador Financeiro (concluída em 2026-07-18)

| # | Task | Status |
|---|---|---|
| 1 | Núcleo de correção (`correction.ts`): fatores anuais, carta e parcela corrigidas, ano de contrato do mês — casos 8 (IGP-M), 9 (IPCA), 10 (taxa zero) | ✅ Concluída |
| 2 | Cronograma e total projetado (`schedule.ts`): total pago por soma mensal, limite pelo prazo (caso 14), série anual sem duplicar ano | ✅ Concluída |
| 3 | Valor futuro de investimentos (`investment.ts`): aporte mensal, capital inicial, CDI efetivo — casos 11, 12, 13 | ✅ Concluída |
| 4 | Comparação consórcio × investimentos (`comparison.ts`) — Modos A e B — + barrel do domínio financeiro | ✅ Concluída |
| 5 | Cenários (`assumptions.ts`) e repository de índices financeiros (`indexes.ts`) | ✅ Concluída |
| 6 | Simulações com snapshot imutável (`computeSimulation` pura + repository/actions) — casos 19, 20 | ✅ Concluída |
| 7 | Painel de simulação: slider de correção, cenários, bloco de premissas (botão "Simular" habilitado no atendimento) | ✅ Concluída |
| 8 | `CdiCompoundSlider` + comparação com investimentos; projeção CDI extraída para o domínio (`cdi.ts`, pura e testada) | ✅ Concluída |
| 9 | Histórico de simulações do cliente (`/clientes/[id]`) e resumo imprimível (`/simulacoes/[id]/resumo`); comparação com CDI persistida no snapshot | ✅ Concluída |
| 10 | Gate da Fase 4 — `pnpm lint && pnpm typecheck && pnpm test` (105 testes) `&& pnpm build` verdes, push para `main` | ✅ Concluída |

**Entregue na Fase 4:**
- Domínio financeiro completo em `src/domain/financial-calculations` (funções puras, `decimal.js`, 100% testado): correção IGP-M/IPCA por ano de contrato, cronograma com total pago somado mês a mês, valor futuro de aporte mensal e capital inicial, CDI efetivo, comparação consórcio × investimentos (Modos A/B) e projeção do `CdiCompoundSlider`.
- Cenários (conservador/base/agressivo/personalizado) e repository de índices econômicos lidos de `financial_indexes` com origem e data (nenhuma taxa hardcoded).
- Simulações com **snapshot imutável**: `computeSimulation` opera sempre sobre o snapshot gravado; editar o produto/taxa depois não altera simulações salvas (casos 19 e 20). A comparação com CDI é capturada no snapshot.
- UI: painel de simulação (slider de tempo recalculando no cliente via funções puras do domínio, sem round-trip), bloco de premissas com aviso de estimativa, cenários, `CdiCompoundSlider` e comparação com investimentos em gráficos (Recharts); histórico por cliente e resumo imprimível (`@media print`, sem lib de PDF).
- Casos obrigatórios do prompt §27 cobertos: 8 (IGP-M, `correction.test.ts`), 9 (IPCA, `correction.test.ts`), 10 (taxa zero, `correction.test.ts`), 11 (CDI composto, `investment.test.ts`), 12 (aporte taxa zero, `investment.test.ts`), 13 (aporte taxa positiva, `investment.test.ts`), 14 (limite pelo prazo, `schedule.test.ts`), 19 (snapshot, `simulations.test.ts`), 20 (produto editado não altera simulação, `simulations.test.ts`).

### Fase 5 — CRM/Pipeline: CANCELADA por decisão do usuário (2026-07-20)

O sistema é de **atendimento único** — o consultor atende um cliente por vez informando o valor disponível e vê os planos compatíveis, simula e (opcionalmente) salva a simulação. Não há necessidade de acompanhar a evolução comercial do cliente ao longo do tempo. Portanto, os itens do prompt §19–21 (pipeline Kanban de oportunidades, follow-ups, dashboard comercial com KPIs) ficam **fora de escopo**. A rota placeholder `/pipeline` e o item de navegação foram removidos (nenhum botão sem função). O cadastro/lista de clientes e o histórico de simulações por cliente (entregues nas Fases 3–4) permanecem, pois sustentam o atendimento.

### Fase 6 — Base de Produtos (PDF) (concluída em 2026-07-20)

| # | Task | Status |
|---|---|---|
| 1 | Parsing puro de produtos a partir de texto (`src/lib/pdf/parse-products.ts`) com confiança por campo, campo pendente = null (nunca inventa), validações §8.9 e mapeamento manual — caso 16 do prompt (campo ausente) | ✅ Concluída |
| 2 | Extração de texto (`pdfjs-dist`) com reconstrução de colunas por geometria + OCR de fallback (`tesseract.js`); fixtures gerados com `pdf-lib` | ✅ Concluída |
| 3 | Storage seguro (bucket privado + policies staff/org), repository de documentos e upload com magic bytes, sanitização, SHA-256 e dedup por hash | ✅ Concluída |
| 4 | Pipeline de processamento + tabela staging `extracted_products` (por campo: value/confidence/raw) com revisão pendente | ✅ Concluída |
| 5 | Revisão humana lado a lado (PDF × dados), edição de campos, mapeamento manual, e publicação com dedup/versionamento auditado — nunca automática | ✅ Concluída |
| 6 | Gate da Fase 6: build corrigido (`serverExternalPackages` para pdfjs/tesseract/canvas), navegação da Fase 5 removida, docs, push | ✅ Concluída |

**Entregue na Fase 6:**
- Área "Base de Produtos" (admin/manager) com upload arrastar-e-soltar, processamento com status, revisão lado a lado e publicação — respeitando as regras invioláveis do prompt §8: nunca publica sem aprovação humana; campo não identificado fica pendente e nunca é inventado; página de origem e confiança armazenadas; OCR para digitalizados; mapeamento manual de colunas; validação de carta/parcelas/prazo/taxas; log legível.
- Parsing e extração 100% testáveis fora do React (`src/lib/pdf`), incluindo o caso obrigatório 16 do prompt (PDF com campo ausente → pendente, não publicável até preenchimento).
- Publicação com deduplicação e versionamento (UPDATE audita estado anterior/novo) reusando a chave de negócio da Fase 2.

### Fase 7 — Qualidade (concluída em 2026-07-20)

| # | Task | Status |
|---|---|---|
| 1 | Infra Playwright + E2E de autenticação (5 cenários); fix real do botão "Sair" (faltava `type="submit"`) | ✅ Concluída |
| 2 | E2E cadastro de cliente + novo atendimento validando o oráculo da planilha (23/240.000, 6, estado vazio, selo de atenção, alerta de risco); fix de cold-start do dev server (globalSetup + timeout) | ✅ Concluída |
| 3 | E2E do simulador: slider, cenários, salvar simulação, resumo imprimível com comparação com CDI | ✅ Concluída |
| 4 | E2E Base de Produtos: upload → processar → revisar → publicar; dedup e bloqueio por campo pendente | ✅ Concluída |
| 5 | Testes de isolamento RLS — casos 17 (entre consultores) e 18 (entre organizações), bidirecional; `docs/SECURITY.md` (modelo de ameaças T1–T11) | ✅ Concluída |
| 6 | Responsividade tablet/mobile (E2E) + 2 fixes reais de layout (`min-w-0` no main, breakpoint da sidebar) | ✅ Concluída |
| 7 | `docs/DEPLOYMENT.md`, verificação dos critérios de aceite, README, gate final e push | ✅ Concluída |

**Entregue na Fase 7:**
- Suíte E2E Playwright (21 testes): autenticação, atendimento (oráculo da planilha), simulador, Base de Produtos e responsividade — rodando headless via `pnpm test:e2e` com aquecimento do dev server.
- Testes de isolamento RLS provando os casos 17 e 18 do prompt com usuários reais autenticados (a policy do Postgres é a barreira, não o código).
- `docs/SECURITY.md` (ameaças e mitigações) e `docs/DEPLOYMENT.md` (roteiro Vercel + Supabase Cloud, com os riscos de PDF/OCR em serverless).
- Bugs reais corrigidos pela verificação E2E: logout sem `type="submit"` (quebrava para usuários reais), cold-start do dev server, e dois problemas de layout responsivo.
- Gate final verde: `pnpm lint` (0), `pnpm typecheck` (0), `pnpm test` (139 unitários/integração), `pnpm test:e2e` (21) e `pnpm build`.

**Mapeamento dos critérios de aceite (prompt §32):**

| # | Critério | Cobertura |
|---|---|---|
| 1 | Consultor entra com sua conta | E2E `auth.spec.ts` |
| 2 | Cadastrar cliente | E2E `atendimento.spec.ts` |
| 3 | Nome + valor disponível → planos compatíveis | E2E `atendimento.spec.ts` (oráculo) |
| 4 | Resultados usam dados reais da planilha | `oracle.test.ts` + importador |
| 5 | Maior carta pagável correta | oráculo (240.000) |
| 6 | Quantidade de elegíveis correta | oráculo (23/6) |
| 7 | Folga mensal correta | `eligibility.test.ts` |
| 8 | Parcela inicial claramente apresentada | E2E atendimento (selo de atenção) |
| 9 | Selecionar plano | E2E `simulacao.spec.ts` |
| 10 | Slider atualiza IGP-M/IPCA | E2E `simulacao.spec.ts` |
| 11 | Slider respeita o prazo | `schedule.test.ts` (caso 14) |
| 12 | CDI com juros compostos | `investment.test.ts` (caso 11) |
| 13 | Gráfico compara consórcio × investimento | painel de simulação / `investment-comparison` |
| 14 | Simulação salva | E2E `simulacao.spec.ts` |
| 15 | Snapshot mantido | `simulations.test.ts` (casos 19/20) |
| 16 | Oportunidade criada | **N/A — Fase 5 cancelada** |
| 17 | Consultor vê só seus dados | `rls-isolation.test.ts` (caso 17) |
| 18 | Admin envia PDF | E2E `base-produtos.spec.ts` |
| 19 | Produtos do PDF passam por revisão | E2E `base-produtos.spec.ts` |
| 20 | Dashboard usa dados reais | **N/A — Fase 5 cancelada** |
| 21 | App funciona em desktop e tablet | E2E `responsive.spec.ts` |
| 22 | Lint, typecheck, testes e build passam | gate final |
| 23 | README permite instalar | `README.md` |

21 dos 23 critérios cobertos; 16 e 20 são N/A por dependerem da Fase 5 (CRM/dashboard comercial), cancelada por decisão do usuário.

## Status do projeto: MVP completo

Fases 1–4, 6 e 7 concluídas; Fase 5 cancelada. Pendências deliberadas: **design visual final** (a ser feito com o usuário, conforme combinado) e **deploy em produção** (roteiro em `docs/DEPLOYMENT.md`).

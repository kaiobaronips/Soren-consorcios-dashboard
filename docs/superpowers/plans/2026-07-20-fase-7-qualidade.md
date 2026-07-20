# Fase 7 — Qualidade: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o sistema com qualidade de produção: testes E2E (Playwright) dos fluxos reais, testes de isolamento RLS (casos 17/18 do prompt), revisão de segurança, responsividade, documentação final (SECURITY.md, DEPLOYMENT.md) e build final — atendendo aos critérios de aceite do prompt §32.

**Architecture:** E2E com Playwright contra o dev server + Supabase local (seed determinístico); testes de isolamento como integração via `@supabase/supabase-js` autenticando usuários reais e provando as policies de RLS. Nenhuma mudança de regra de negócio — a fase é de verificação, endurecimento e documentação.

**Tech Stack:** Playwright (`@playwright/test`), Supabase local, o que já existe.

## Escopo ajustado (Fase 5 cancelada)

O sistema é de **atendimento único**. Os fluxos E2E do prompt §27 que dependem de CRM/Kanban/dashboard comercial (criação de oportunidade, visualização do dashboard comercial) estão **fora de escopo**. Os fluxos cobertos: login, cadastro de cliente, novo atendimento (elegibilidade/ranking), seleção de produto, simulador (slider), salvar simulação, resumo imprimível, upload e revisão de PDF, e isolamento entre consultores/organizações.

## Global Constraints (valem para TODAS as tasks)

- TypeScript `strict: true`; lint 0 warnings; pnpm. Diretório: `/Users/kaiobp/Documents/Soren-Consorcio-dashboard` (git, `main`).
- E2E não pode depender de estado sujo: cada teste cria e limpa seus próprios dados (ou usa prefixos únicos), e assume o seed base (org "Soren Consórcios", usuários demo, 63+8 produtos). Nunca usar pessoas reais.
- Testes E2E rodam headless via `pnpm test:e2e` (browsers próprios do Playwright — não depende do MCP). Supabase local (API 54331) e dev server precisam estar de pé; o `webServer` do Playwright sobe o `pnpm dev`.
- Credenciais demo: admin@ / gestor@ / ana@ / bruno@demo.soren.com.br, senha `demo12345`.
- Não alterar regras de negócio; correções de bug encontradas viram commits próprios com teste.
- UI neutra shadcn — **nenhuma decisão de identidade visual** (o design final será feito com o usuário depois). Responsividade = layout não quebra em tablet/mobile, sem redesenhar.
- Commits pt-BR convencional terminando com: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Casos obrigatórios do prompt cobertos NESTA fase: 17 (isolamento entre consultores) e 18 (isolamento entre organizações). Fluxos E2E do §27 aplicáveis ao escopo.
- Critérios de aceite: prompt §32 (1–23), exceto os itens 16/20 dependentes da Fase 5 cancelada.

---

### Task 1: Infra Playwright + E2E de autenticação

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers/auth.ts`, `e2e/auth.spec.ts`
- Modify: `package.json` (scripts `test:e2e`, `test:e2e:ui`), `.gitignore` (`/test-results`, `/playwright-report`, `/e2e/.auth`)

**Interfaces:**
- Produces: `login(page, email, password)` helper; config com `webServer` (dev server), `baseURL http://localhost:3000`, projeto chromium, `fullyParallel: false` (evita corrida no Supabase local), retries 1.

- [ ] **Step 1:** `pnpm add -D @playwright/test` e `pnpm exec playwright install chromium`.
- [ ] **Step 2:** `playwright.config.ts`: `webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120000 }`; `use: { baseURL, trace: "on-first-retry" }`; testDir `e2e`.
- [ ] **Step 3:** helper `login` (vai para `/login`, preenche e-mail/senha, submete, espera URL `/`).
- [ ] **Step 4:** `e2e/auth.spec.ts`: (a) rota protegida sem sessão redireciona para `/login`; (b) login com credenciais erradas mostra "E-mail ou senha incorretos"; (c) login admin entra e vê a navegação; (d) logout ("Sair") volta para `/login` e a rota protegida volta a redirecionar; (e) consultora ana@ NÃO vê "Base de Produtos" nem "Configurações".
- [ ] **Step 5:** `pnpm test:e2e` verde; `pnpm lint && pnpm typecheck` verdes. Commit: `test(e2e): infra Playwright e fluxo de autenticação`

---

### Task 2: E2E — cadastro de cliente + novo atendimento (oráculo)

**Files:**
- Create: `e2e/atendimento.spec.ts`, `e2e/helpers/cleanup.ts`

**Interfaces:**
- Consumes: `login` (T1). `cleanup.ts`: usa service role (`SUPABASE_SERVICE_ROLE_KEY`) para apagar clientes/simulações de teste por prefixo de nome (`[E2E]`).

- [ ] **Step 1:** helper de limpeza (afterEach/afterAll apaga registros `name ilike '[E2E]%'`).
- [ ] **Step 2:** `atendimento.spec.ts`:
  - (a) **Oráculo João Silva**: novo atendimento, cliente novo "[E2E] João", disponível `1500`, categoria Imóvel → resumo mostra **23** produtos elegíveis e maior carta **R$ 240.000,00** (bate com a planilha); há um "Plano recomendado".
  - (b) disponível `800` → **6** elegíveis; disponível `500` → estado vazio com dica.
  - (c) **selo de atenção**: um produto com parcela 1ª–12ª acima do disponível aparece com selo "atenção" (parcela inicial nunca escondida).
  - (d) renda `2000` + disponível `1500` → alerta de risco visível (75% > 30%).
  - (e) busca incremental encontra o cliente recém-criado ao digitar o nome.
- [ ] **Step 3:** `pnpm test:e2e` verde. Commit: `test(e2e): cadastro de cliente e novo atendimento validando o oráculo da planilha`

---

### Task 3: E2E — simulador (produto → slider → salvar → resumo imprimível)

**Files:**
- Create: `e2e/simulacao.spec.ts`

- [ ] **Step 1:** `simulacao.spec.ts` (a partir de um atendimento com cliente `[E2E]`):
  - (a) clicar "Simular" no plano recomendado abre o painel; o bloco de premissas mostra índice, taxa, origem e o aviso de estimativa.
  - (b) **mover o slider** de tempo altera os valores exibidos (carta corrigida/parcela/total) — capturar valor antes e depois e afirmar que mudou.
  - (c) trocar cenário (Base → Agressivo) altera a projeção.
  - (d) **salvar simulação** → aparece confirmação; a simulação fica no histórico do cliente (`/clientes/[id]`).
  - (e) abrir o **resumo imprimível** (`/simulacoes/[id]/resumo`) mostra cliente, produto, premissas e a comparação com CDI (valor, não "não registrada").
  - (f) consultor personalizado: como consultora ana@, o input de taxa personalizada NÃO aparece.
- [ ] **Step 2:** `pnpm test:e2e` verde. Commit: `test(e2e): simulador — slider, cenários, salvar simulação e resumo imprimível`

---

### Task 4: E2E — Base de Produtos (upload → revisar → publicar)

**Files:**
- Create: `e2e/base-produtos.spec.ts`

- [ ] **Step 1:** `base-produtos.spec.ts` como admin@, usando `tests/fixtures/tabela-simples.pdf`:
  - (a) upload do PDF (dropzone/input file) → documento aparece na lista com status.
  - (b) processar → status vira "revisão"; abrir revisão mostra os produtos extraídos com badges de confiança e o PDF ao lado.
  - (c) editar um campo pendente/errado, **aprovar** e **publicar** → produto aparece em `/produtos`.
  - (d) **re-upload** do mesmo arquivo → aviso de duplicado (não reprocessa).
  - (e) tentar publicar um candidato com campo **pendente** → erro claro, não publica.
  - Limpar ao final (documento, extraídos, produto publicado, objeto no Storage) via service role.
- [ ] **Step 2:** `pnpm test:e2e` verde (timeout generoso para o processamento). Commit: `test(e2e): Base de Produtos — upload, revisão e publicação com dedup`

---

### Task 5: Testes de isolamento RLS (casos 17 e 18) + revisão de segurança

**Files:**
- Create: `src/repositories/rls-isolation.test.ts` (integração, roda no Vitest com Supabase local), `docs/SECURITY.md`

**Interfaces:**
- Usa dois clients `@supabase/supabase-js` autenticados (anon key + signInWithPassword) para ana@ e bruno@ (mesmo org) e um segundo org (criado no teste via service role) para o caso 18.

- [ ] **Step 1 (caso 17 — isolamento entre consultores):** ana@ cria um cliente; autenticando como bruno@ (mesma org, papel consultant), a query de clientes **não** retorna o cliente da ana (policy `clients_select` restringe consultor aos próprios). Provar também que o admin@ **vê** ambos (staff). Limpar.
- [ ] **Step 2 (caso 18 — isolamento entre organizações):** via service role, criar uma 2ª org + 1 usuário; esse usuário não enxerga nenhum cliente/produto/simulação da org "Soren Consórcios" e vice-versa. Limpar a org de teste.
- [ ] **Step 3:** `docs/SECURITY.md`: modelo de ameaças e mitigações — RLS por org + papel (com a matriz de policies), validação server-side (Zod), proteção de rotas (`proxy.ts`), storage privado com policies, upload (magic bytes/tamanho/sanitização), auditoria (`audit_logs`), segredos só em env, menor privilégio de grants (migration de hardening), exclusão lógica de clientes (`deleted_at`), LGPD (finalidade/consentimento — o que está implementado e o que é roadmap).
- [ ] **Step 4:** `pnpm test` (inclui os novos de isolamento) verde. Commit: `test: isolamento RLS entre consultores e organizações (casos 17 e 18) + docs/SECURITY.md`

---

### Task 6: Responsividade, acessibilidade e performance

**Files:**
- Create: `e2e/responsive.spec.ts`
- Modify: componentes que quebrarem em telas estreitas (ajustes mínimos de layout — sem redesign)

- [ ] **Step 1:** `responsive.spec.ts`: nas viewports tablet (768×1024) e mobile (390×844), as páginas principais (`/`, `/atendimento`, `/produtos`, `/clientes`) renderizam sem **overflow horizontal do body** (medir `document.body.scrollWidth <= window.innerWidth + 1`) e a sidebar colapsa (trigger visível). A tela "Novo atendimento" deve funcionar bem em notebook e tablet (§22).
- [ ] **Step 2:** corrigir apenas o que quebrar: tabelas em `overflow-x-auto` (produtos já usa), grids que viram 1 coluna, gráficos com `ResponsiveContainer` (já usam). Nenhuma cor/identidade nova.
- [ ] **Step 3:** performance: conferir que `pnpm build` não traz avisos de bundle grave; imagens (nenhuma pesada); confirmar que o domínio financeiro não roda no servidor a cada slider (já é client-side). Registrar achados no relatório.
- [ ] **Step 4:** `pnpm test:e2e && pnpm lint && pnpm typecheck` verdes. Commit: `test(e2e): responsividade tablet/mobile e ajustes de layout`

---

### Task 7: Documentação final, DEPLOYMENT.md, verificação dos critérios de aceite + gate + push

**Files:**
- Create: `docs/DEPLOYMENT.md`
- Modify: `README.md` (marcar Fase 7 concluída, atualizar limitações/roadmap), `PLANS.md`, `docs/ARCHITECTURE.md` (se algo mudou)

- [ ] **Step 1:** `docs/DEPLOYMENT.md`: deploy na Vercel + Supabase cloud — variáveis de ambiente (as do `.env.example`), passos de migração (`supabase db push`), criação do primeiro admin, execução do seed/import, checklist pós-deploy, e a ressalva do worker do pdfjs em serverless (validar a extração/OCR no runtime de produção; OCR pode exigir ajuste de `standardFontDataUrl`/binário do canvas).
- [ ] **Step 2:** Verificação dos critérios de aceite (§32, itens aplicáveis 1–15, 17–19, 21–23): rodar a suíte E2E completa e mapear no relatório qual teste cobre cada critério; itens 16 e 20 marcados N/A (Fase 5 cancelada).
- [ ] **Step 3:** README: Fase 7 **concluída**; seção "Testes" com `pnpm test` e `pnpm test:e2e`; limitações conhecidas atualizadas (OCR de tabelas complexas, deploy não executado, design final pendente); roadmap.
- [ ] **Step 4:** **Gate final**: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build` — tudo verde.
- [ ] **Step 5:** PLANS.md — Fase 7 concluída com entregas e o mapeamento dos critérios de aceite. Commit docs + `git push`.

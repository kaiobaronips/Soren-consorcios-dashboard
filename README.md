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

## Estado atual: Fase 3 — Atendimento concluída

Concluído até aqui: scaffold do projeto, análise da planilha de referência, Supabase local com migrations (schema completo das 11 tabelas, RLS, grants), seed de desenvolvimento, autenticação (login/logout via Supabase Auth, proteção de rotas por `src/proxy.ts`), layout base com sidebar, CRUD de produtos completo (normalização decimal-safe, parser XLSX com testes-oráculo, plano de importação idempotente, script `pnpm import:xlsx`, página `/produtos`), e o fluxo de atendimento completo — cadastro/busca de clientes, domínio de elegibilidade/ranking (`src/domain/eligibility`, `src/domain/recommendation`) e a tela "Novo atendimento" (`/atendimento`). Ver `PLANS.md` para o detalhamento task a task.

Ainda não implementado: simulação de reajustes IGP-M/IPCA/CDI com sliders e snapshots (Fase 4), oportunidades/CRM, dashboard comercial, upload/extração de PDF.

## Roadmap de fases

| Fase | Conteúdo |
|---|---|
| 1 Fundação | Análise da planilha, scaffold, Supabase local, migrations, auth, perfis, RLS, layout base, docs de planejamento — **concluída** |
| 2 Produtos | CRUD de produtos, importador XLSX idempotente, listagem, filtros, ativação — **concluída** |
| 3 Atendimento | Cadastro/busca de clientes, tela "Novo atendimento", elegibilidade, ranking, cards de resultado — **concluída** |
| 4 Simulador | Correção IGP-M/IPCA/CDI, sliders, gráficos, premissas, cenários, snapshots de simulação, resumo imprimível — **concluída** |
| 5 CRM | Oportunidades, Kanban, interações, follow-ups, dashboard comercial — disponível na Fase 5 |
| 6 PDF | Upload de PDFs de produtos, extração, OCR, revisão humana, publicação, versionamento — disponível na Fase 6 |
| 7 Qualidade | Testes completos (unitários + E2E), segurança, responsividade, performance, build final — disponível na Fase 7 |

Detalhamento e status atualizado em `PLANS.md`.

## Deploy

Não executado neste ciclo. O plano é rodar localmente (`pnpm dev`) durante todo o desenvolvimento; documentação de deploy para Vercel (`docs/DEPLOYMENT.md`) será escrita e o deploy realizado apenas na Fase 7 — disponível na Fase 7.

## Importação de dados (XLSX)

Com o Supabase local rodando (`pnpm supabase start`) e `.env.local` configurado, importe (ou reimporte) a planilha de produtos:

```bash
pnpm import:xlsx references/consorcio.xlsx
```

O importador lê a aba "Consórcios" do arquivo, normaliza os valores monetários/percentuais com `decimal.js` e compara cada linha contra o banco pela chave de negócio `product_code + category + term_months + credit_amount`:

- **Insere** produtos novos (chave inexistente no banco).
- **Atualiza** produtos cuja chave já existe mas algum campo mudou.
- **Ignora** produtos já importados e sem alteração — reexecutar o comando várias vezes é seguro (idempotente) e não duplica nem sobrescreve à toa.

Ao final, imprime um relatório: `Inseridos / Atualizados / Ignorados (sem mudança) / Linhas inválidas / Erros`. Linhas inválidas (dados fora do formato esperado) e erros de gravação não interrompem o processamento das demais linhas.

Produtos de veículo (`category=vehicle`) não constam na planilha de referência; um pequeno conjunto demo (`is_demo=true`) é inserido via `pnpm db:seed` para completar o catálogo em desenvolvimento.

Ver `docs/ANALISE_PLANILHA.md` para o mapeamento completo planilha → banco.

## Tela "Novo atendimento"

Fluxo principal de venda, disponível em `/atendimento` para qualquer usuário autenticado (consultor, gestor ou admin):

1. **Cliente**: busca incremental por nome/e-mail/telefone (clientes já cadastrados) ou cadastro de um novo cliente direto na tela, informando nome, renda mensal (opcional) e valor mensal disponível para a parcela.
2. **Preferências opcionais**: categoria desejada (imóvel/veículo/outro/todas) e prazo desejado — usadas apenas para pontuar o ranking, não filtram a elegibilidade.
3. Ao submeter, o service `runAtendimento` (`src/services/atendimento.ts`) busca os produtos ativos (`listProducts`) e as configurações da organização (`getOrgSettings`, aba "Configurações" — `eligibilityBasis` e `maxIncomeCommitmentPercent`), roda o domínio de elegibilidade (`src/domain/eligibility`) e o ranking (`src/domain/recommendation`) e devolve:
   - **Resumo de elegibilidade**: quantidade de planos elegíveis, maior carta pagável, faixa de parcela compatível, melhor folga mensal e comprometimento máximo de renda.
   - **Cards ranqueados**: cada produto elegível com sua classificação (`compatible`/`attention`), folga mensal, comprometimento de renda e os motivos (`reasons`) que compuseram o score — nunca uma "caixa preta".
   - **Destaques** (`highlights`): maior carta, menor parcela, menor prazo, menor taxa e melhor equilíbrio carta/parcela entre os elegíveis.
   - **Alerta de risco**: exibido quando o comprometimento de renda do cliente ultrapassa o teto configurado em `maxIncomeCommitmentPercent` (padrão da organização, ajustável em `/configuracoes`).

A regra de qual parcela conta para elegibilidade (`basis`: recorrente / 1ª–12ª / a maior das duas) é configurável por organização — não fixa no código — e documentada em `docs/CALCULATIONS.md`.

## Simulador financeiro

A partir de qualquer card do atendimento, o botão **"Simular"** abre o painel de simulação:

- **Slider de tempo** (0 → prazo do produto): recalcula ao vivo, no cliente, a carta corrigida, a parcela no período, o total pago até o mês e a correção acumulada — usando as funções puras de `src/domain/financial-calculations` (nenhum round-trip por movimento do slider). Imóveis usam IGP-M; veículos, IPCA.
- **Bloco de premissas**: índice, taxa anual, origem, data de atualização, tipo (projetada/histórica/manual) e o aviso de que se trata de estimativa, não garantia. As taxas vêm de `financial_indexes` — nunca hardcoded.
- **Cenários**: conservador / base / agressivo / personalizado (o input de taxa personalizada só aparece para admin/manager).
- **`CdiCompoundSlider`** e **comparação com investimentos** (Modo A = aporte igual à parcela; Modo B = capital igual à carta): evolução patrimonial em gráfico, com a ressalva de que consórcio e investimento têm objetivos, riscos e liquidez diferentes.
- **Salvar simulação**: grava um snapshot imutável (produto + premissas + comparação com CDI no momento). Editar o produto/taxa depois não altera simulações já salvas. O histórico fica na página do cliente (`/clientes/[id]`) e cada simulação gera um resumo imprimível (`/simulacoes/[id]/resumo`).

## Geração de PDF / resumo imprimível

Resumo de simulação como página print-friendly do navegador (`@media print`, sem dependência de biblioteca de PDF), em `/simulacoes/[id]/resumo` — **concluído na Fase 4**. Upload e extração de PDFs de produtos (com OCR de fallback) — disponível na Fase 6.

## Segurança e LGPD

RLS em todas as tabelas de negócio (ver `docs/DATABASE.md`), validação Zod em toda entrada de Server Action, proteção de rotas por sessão via `src/proxy.ts`, `audit_logs` para rastreabilidade, exclusão lógica de clientes (`deleted_at`), segredos apenas em variáveis de ambiente (nunca commitadas). Detalhamento em `docs/ARCHITECTURE.md`.

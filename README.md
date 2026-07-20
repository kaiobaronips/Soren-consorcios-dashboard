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
pnpm test                    # Vitest (unitários + integração RLS)
pnpm test:watch               # Vitest em modo watch
pnpm test:e2e                  # Playwright (end-to-end)
pnpm db:seed                    # roda scripts/seed.ts (idempotente)
pnpm import:xlsx references/consorcio.xlsx   # importa os 63 produtos da planilha

pnpm exec supabase start             # sobe o Supabase local
pnpm exec supabase stop                # derruba o Supabase local
pnpm exec supabase db reset              # reaplica todas as migrations do zero
```

> Use sempre `pnpm exec supabase` (a versão do projeto), não um binário global — há incompatibilidade conhecida de parsing do `config.toml` em versões diferentes.

## Testes

- **Unitários e de integração** (`pnpm test`, Vitest): domínio financeiro e de elegibilidade (validado contra o **oráculo da planilha** — os 4 clientes reais e os 63 produtos), parsing de XLSX/PDF, normalização decimal, snapshot de simulação e **isolamento RLS** (casos 17/18: entre consultores e entre organizações). Os testes de RLS assumem o Supabase local de pé e semeado.
- **End-to-end** (`pnpm test:e2e`, Playwright): autenticação, cadastro de cliente + novo atendimento (conferindo os números da planilha), simulador (slider/cenários/salvar/resumo), Base de Produtos (upload → revisão → publicação) e responsividade tablet/mobile. O Playwright sobe o dev server automaticamente e aquece as rotas antes da suíte.

## Estado atual: MVP completo (Fases 1–4, 6 e 7)

Fluxo completo funcionando e testado (unitário + E2E): autenticação, cadastro de cliente, **novo atendimento** com elegibilidade/ranking validados contra o oráculo da planilha, **simulador financeiro** (correção IGP-M/IPCA, CDI com juros compostos, comparação com investimentos, cenários e snapshots imutáveis), resumo imprimível, e **Base de Produtos** (importação de PDF com revisão humana obrigatória e publicação com versionamento). Isolamento por organização e por consultor garantido por RLS e testado. Ver `PLANS.md` para o detalhamento task a task e o mapeamento dos critérios de aceite.

**Pendências deliberadas:** o **design visual final** (a ser feito com o cliente, segundo seus critérios) e o **deploy em produção** (roteiro em `docs/DEPLOYMENT.md`). A **Fase 5** (CRM/Kanban/dashboard comercial) foi **cancelada** por decisão do cliente — o sistema é de atendimento único.

## Limitações conhecidas

- **Design visual:** a interface usa componentes shadcn/ui neutros, sem identidade visual — o design final será definido em conjunto com o cliente.
- **Deploy:** não executado; roteiro em `docs/DEPLOYMENT.md`. A extração de PDF/OCR precisa de revalidação no runtime serverless (ver riscos no documento).
- **OCR:** tabelas digitalizadas complexas tendem a gerar muitos campos pendentes (por design — o sistema prefere pendente a inventar dado).
- **Índices econômicos:** cadastrados manualmente com origem e data; a sincronização automática com fontes oficiais (SGS/Bacen) é roadmap.
- **LGPD / exclusão lógica:** `deleted_at` está no schema; a anonimização/exclusão pela aplicação é roadmap (ver `docs/SECURITY.md`).

## Roadmap de fases

| Fase | Conteúdo |
|---|---|
| 1 Fundação | Análise da planilha, scaffold, Supabase local, migrations, auth, perfis, RLS, layout base, docs de planejamento — **concluída** |
| 2 Produtos | CRUD de produtos, importador XLSX idempotente, listagem, filtros, ativação — **concluída** |
| 3 Atendimento | Cadastro/busca de clientes, tela "Novo atendimento", elegibilidade, ranking, cards de resultado — **concluída** |
| 4 Simulador | Correção IGP-M/IPCA/CDI, sliders, gráficos, premissas, cenários, snapshots de simulação, resumo imprimível — **concluída** |
| 5 CRM | Oportunidades, Kanban, follow-ups, dashboard comercial — **cancelada** (sistema de atendimento único; ver `PLANS.md`) |
| 6 PDF | Upload de PDFs de produtos, extração, OCR, revisão humana lado a lado, publicação com versionamento — **concluída** |
| 7 Qualidade | Testes completos (unitários + E2E), segurança (RLS/isolamento), responsividade, documentação e build final — **concluída** |

Detalhamento e status atualizado em `PLANS.md`.

## Deploy

Não executado neste ciclo — o desenvolvimento roda localmente (`pnpm dev` + Supabase local). O roteiro completo de deploy para Vercel + Supabase Cloud (migrations, variáveis de ambiente, primeiro admin, seed/import e os riscos de PDF/OCR em serverless) está em `docs/DEPLOYMENT.md`.

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

## Base de Produtos (importação de PDF)

Área administrativa em `/base-produtos` (admin/manager) para transformar tabelas de consórcio em PDF em produtos do catálogo, com **revisão humana obrigatória**: upload arrastar-e-soltar (validação de magic bytes, limite de tamanho, dedup por hash), extração de texto com `pdfjs-dist` e **OCR de fallback** (`tesseract.js`) para PDFs digitalizados, identificação de produtos com confiança por campo (campo não reconhecido fica **pendente**, nunca inventado), revisão lado a lado (PDF × dados) com mapeamento manual de colunas, e publicação com deduplicação/versionamento — nunca automática. Detalhes em `docs/PDF_IMPORT.md`.

## Geração de PDF / resumo imprimível

Resumo de simulação como página print-friendly do navegador (`@media print`, sem dependência de biblioteca de PDF), em `/simulacoes/[id]/resumo` — **concluído na Fase 4**.

## Segurança e LGPD

RLS em todas as tabelas de negócio (ver `docs/DATABASE.md`), validação Zod em toda entrada de Server Action, proteção de rotas por sessão via `src/proxy.ts`, `audit_logs` para rastreabilidade, exclusão lógica de clientes (`deleted_at`), segredos apenas em variáveis de ambiente (nunca commitadas). Detalhamento em `docs/ARCHITECTURE.md`.

# Prompt de handoff — Design/UI do Soren Consórcio Dashboard

> Cole o bloco abaixo (a partir de "Você é...") no terminal da outra LLM, dentro da pasta do projeto.

---

Você é um designer de produto e engenheiro front-end sênior. Sua missão é criar a **identidade visual e o design da interface** de um sistema web que **já está 100% funcional** — toda a lógica de negócio, banco, autenticação e telas existem e funcionam. Você vai transformar a UI neutra atual em uma interface profissional, sem quebrar nada do que já funciona.

## Onde está o projeto

Pasta: `/Users/kaiobp/Documents/Soren-Consorcio-dashboard` (repositório git, branch `main`). Comece lendo, nesta ordem: `README.md`, `PLANS.md`, `docs/ARCHITECTURE.md`. Não confie na sua memória sobre o código — leia os arquivos.

## O que é o sistema

Sistema comercial para venda de **consórcios** (imóveis e veículos). Um consultor atende um cliente informando o valor mensal disponível e o sistema mostra os planos compatíveis, simula reajustes (IGP-M/IPCA/CDI) e compara com investimentos. É um sistema de **atendimento único** (não é um CRM com acompanhamento de evolução). Idioma: **português do Brasil**.

## Stack (não trocar)

- Next.js 16 (App Router) + React + TypeScript **estrito**
- Tailwind CSS + **shadcn/ui** (atenção: usa `@base-ui/react` por baixo — componentes usam a prop `render`, **não** `asChild`; diálogos fecham por comparação de estado no render, não `setState` dentro de `useEffect`)
- Supabase (Postgres/Auth/Storage) — **local**, já configurado
- Recharts (gráficos), decimal.js (valores)

## Como rodar e ver

```bash
cd /Users/kaiobp/Documents/Soren-Consorcio-dashboard
pnpm install
pnpm exec supabase start      # sobe o Supabase local (Docker precisa estar rodando)
pnpm db:seed                  # dados demo (idempotente)
pnpm import:xlsx references/consorcio.xlsx   # 63 produtos reais
pnpm dev                      # http://localhost:3000
```

Login em http://localhost:3000 — contas demo (senha `demo12345`):
- `admin@demo.soren.com.br` (admin — vê tudo, incluindo Base de Produtos e Configurações)
- `ana@demo.soren.com.br` (consultora — visão restrita)

Sempre use `pnpm exec supabase` (não um binário global).

## As telas a projetar (rotas)

- `/login` — autenticação
- `/` — início (entrada para o atendimento)
- `/atendimento` — **tela principal**: formulário (cliente, renda, valor disponível, categoria), cabeçalho-resumo (maior carta pagável, nº de planos elegíveis, folga, comprometimento, alerta de risco) e **cards de resultado** ranqueados com selo de compatibilidade e botão "Simular"
- `/produtos` — catálogo (tabela com filtros; admin cadastra/ativa/inativa)
- `/clientes` e `/clientes/[id]` — lista e página do cliente (dados + histórico de simulações)
- `/base-produtos` e `/base-produtos/[id]` — admin: upload de PDF e **revisão lado a lado** (PDF × dados extraídos) com badges de confiança
- `/configuracoes` — admin: taxas, regra de elegibilidade
- `/simulacoes/[id]/resumo` — **página imprimível** do resumo da simulação (tem `@media print`)
- O **painel de simulação** (abre a partir de um card do atendimento): slider de tempo, bloco de premissas, cenários, `CdiCompoundSlider` e comparação com investimentos em gráficos

Componentes de UI ficam em `src/components/ui/` (shadcn) e as telas em `src/features/*` e `src/app/(app)/*`. A sidebar é `src/components/app-sidebar.tsx`. Formatação de moeda/data/percentual em `src/lib/format.ts` (pt-BR, BRL, `dd/MM/yyyy`).

## Direção visual desejada (ponto de partida — confirme comigo antes de aplicar)

Financeira, institucional, moderna, clara e de alta legibilidade. Fundo claro, navegação lateral, cards limpos, hierarquia forte, **valores financeiros em destaque**, gráficos sem excesso de elementos, animações discretas, responsiva (a tela de atendimento deve funcionar bem em notebook e tablet). Cores semânticas: verde = compatível; amarelo = atenção; vermelho = incompatível/risco; azul ou teal como cor institucional. Suporte a tema claro/escuro é bem-vindo, não obrigatório.

**Antes de começar a desenhar, me pergunte** (o dono do produto): existe logo/marca, paleta preferida, referências de sistemas que eu goste, e se quero tema escuro. Não invente identidade de marca sem me consultar — traga 1–2 propostas para eu escolher.

## Regras invioláveis (o que você NÃO pode quebrar)

1. **Não altere regra de negócio.** Nada em `src/domain/`, `src/services/`, `src/repositories/` ou nas migrations `supabase/`. Seu trabalho é visual: `src/components/`, `src/features/*` (JSX/estilo), `src/app/(app)/*` (layout/estilo), `src/app/globals.css`, `tailwind`/tema.
2. **Mantenha os gates verdes.** Rode e não regrida: `pnpm lint` (0 avisos), `pnpm typecheck`, `pnpm test` (139 testes) e **`pnpm test:e2e`** (21 testes Playwright). Os testes E2E localizam elementos por **texto e `role`** (ex.: botão "Simular", "Entrar", "Planos elegíveis", selos). Se você mudar um texto/rótulo visível, **atualize o teste E2E correspondente** em `e2e/*.spec.ts` no mesmo commit — nunca deixe a suíte vermelha.
3. **TypeScript estrito e lint limpos** — não desabilite regras.
4. **pt-BR** em toda a interface. Dinheiro sempre via `formatCurrency` (nunca `float` cru); os valores vêm do backend como string (ex.: `"1234.56"`).
5. Componentes shadcn/base-ui: use a prop `render` (não `asChild`); diálogos já seguem um padrão de fechar sem `setState` em `useEffect` — mantenha.
6. Preserve acessibilidade: `label`/`htmlFor`, foco visível, contraste adequado, `aria-*` onde já existe.
7. Trabalhe em **commits pequenos** por área (login, sidebar, atendimento, cards, simulador, produtos, base-produtos), rodando o gate a cada um. Não faça um "big bang".

## Contexto útil

- Docs: `docs/ARCHITECTURE.md` (camadas), `docs/CALCULATIONS.md` (fórmulas), `docs/SECURITY.md`, `docs/PDF_IMPORT.md`, `docs/DATABASE.md`.
- Os selos de compatibilidade e cores semânticas já existem de forma neutra em `src/features/atendimento/result-cards.tsx` e no cabeçalho `summary-header.tsx` — bom lugar para começar.
- O projeto foi construído em fases; a Fase 5 (CRM/Kanban/dashboard comercial) foi **cancelada** — não recrie essas telas.

## Como entregar

Ao final, me mostre as telas rodando (`pnpm dev`), confirme que `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build` passam, e faça commits em português (mensagem convencional). Comece se apresentando, listando o que leu do projeto, e me fazendo as perguntas de design antes de escrever qualquer CSS.

# Soren Consórcio Dashboard — Design Spec

**Data:** 2026-07-16
**Status:** Aprovado pelo usuário (Kaio)
**Repositório:** https://github.com/kaiobaronips/Soren-consorcios-dashboard.git

## 1. Objetivo

Sistema web comercial para venda de consórcios. Um consultor, durante o atendimento, informa nome do cliente, renda mensal e valor disponível mensal e recebe em segundos: planos elegíveis ranqueados, simulação de reajustes (IGP-M/IPCA), comparação com investimentos (CDI/poupança), com salvamento de simulações (snapshot imutável) e criação de oportunidades em um CRM com Kanban e dashboard comercial.

Fonte funcional: planilha `references/consorcio.xlsx` (abas Dashboard, Cartões, Consórcios, Clientes, Oportunidades). A lógica da planilha é preservada e ampliada; após a importação, o sistema depende apenas do banco de dados.

## 2. Decisões acordadas com o usuário

| Decisão | Escolha |
|---|---|
| Backend | Supabase **local** (CLI + Docker) durante o desenvolvimento; migrations versionadas prontas para conectar projeto cloud depois |
| Design visual | UI **funcional neutra** (shadcn/ui padrão). Identidade visual será definida em sessão conjunta com o usuário AO FINAL. Nenhuma decisão estética própria |
| Escopo PDF | Fases 1–5 primeiro (MVP completo com dados da planilha); Fase 6 (PDF/OCR) por último |
| Deploy | Local (`pnpm dev`) + `docs/DEPLOYMENT.md` pronto para Vercel; sem deploy neste ciclo |
| Fluxo de trabalho | Estrutura e revisão: Fable 5. Produção das tasks: agentes Sonnet 5. Revisão Fable 5 ao final de cada task/fase |

## 3. Regras de negócio descobertas na planilha (engenharia reversa)

Aba **Consórcios**: 63 produtos de imóvel. Cartas R$ 120.000–600.000; prazos 200/220/240 meses; taxa adm total 24,8%/25,8%/26,8% (correlata ao prazo).

Regras implícitas (não documentadas na planilha, verificadas contra os 63 produtos):

```
parcela_mensal    = carta × (1 + taxa_adm + 0,02) ÷ prazo      # 2% = fundo de reserva
parcela_1a_a_12a  = parcela_mensal + 0,001 × carta             # +0,1% da carta nos 12 primeiros meses
```

Exemplos de verificação: IE580-240m → 580.000 × 1,288 ÷ 240 = 3.112,67 ✓; IE600-240m → parcela 3.220, primeira parcela 3.820 (+600 = 0,1% de 600.000) ✓.

Aba **Clientes**: nome + "dividendo mensal" (valor disponível). Fórmulas:
- Maior carta pagável: `MAXIFS(carta; parcela_mensal <= dividendo)`
- Produtos elegíveis: `COUNTIFS(parcela_mensal <= dividendo)`

Aba **Oportunidades**: produto cartesiano cliente × produto com `folga = dividendo − parcela` e flag `elegível = parcela <= dividendo`, ordenado por maior folga.

Aba **Cartões**: top 10 produtos por cliente (maiores parcelas que cabem). Aba **Dashboard**: seletor de cliente + resumo (maior carta, produtos que cabem, menor parcela, maior parcela que cabe, comprometimento máximo, carta recomendada) + lista de elegíveis por parcela decrescente.

Oráculo de testes (dados reais da planilha):

| Cliente | Dividendo | Maior carta | Produtos elegíveis |
|---|---|---|---|
| João Silva | 1.500 | 240.000 | 23 |
| Maria Souza | 3.200 | 580.000 | 56 |
| Carlos Pereira | 800 | 140.000 | 6 |
| JANDIRINHA | 4.550 | 600.000 | 63 |

A planilha NÃO possui renda mensal — apenas o valor disponível. O sistema armazena os dois campos separados (`monthly_income` e `monthly_available_amount`), nunca como sinônimos.

Detalhamento completo em `docs/ANALISE_PLANILHA.md` (Fase 1).

## 4. Stack

Next.js (App Router) · React · TypeScript estrito · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL, Auth, Storage, RLS) · React Hook Form · Zod · Recharts · decimal.js · SheetJS (`xlsx`) para importação · `pdfjs-dist` + `tesseract.js` (Fase 6) · Vitest · Playwright · pnpm. Versões estáveis atuais no momento da implementação.

## 5. Arquitetura (Abordagem A — server-first com domínio puro)

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

Estrutura de pastas (conforme prompt, seção 25):

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

Princípios:
- Elegibilidade + ranking calculados **no servidor** (auditável, consistente).
- Correção IGP-M/IPCA/CDI e comparações calculadas **no cliente** pelas mesmas funções puras do domínio (slider instantâneo, sem round-trip).
- Dinheiro: `NUMERIC(14,2)` no Postgres; `decimal.js` no domínio; formatação `pt-BR`/BRL/`America/Sao_Paulo` apenas na borda da UI. Nunca float binário para persistir dinheiro.
- Nenhuma taxa financeira hardcoded: tudo em `financial_indexes` / `system_settings` com origem e data.
- Funções de domínio mínimas (prompt, seção 26): `getEligibleProducts`, `calculateMonthlySlack`, `calculateIncomeCommitment`, `rankConsortiumProducts`, `calculateCorrectedCredit`, `calculateCorrectedInstallment`, `calculateCorrectedPaymentSchedule`, `calculateTotalProjectedPayments`, `calculateCompoundFutureValue`, `calculateMonthlyContributionFutureValue`, `compareConsortiumAndInvestments`.

## 6. Modelo de dados

As 11 tabelas do prompt (seção 6), com migrations SQL versionadas pelo Supabase CLI:
`organizations`, `profiles`, `clients`, `consortium_products`, `product_documents`, `simulations`, `opportunities`, `interactions`, `financial_indexes`, `system_settings`, `audit_logs`.

Decisões adicionais:
- `consortium_products.reserve_fund_percent` preenchido com os 2% descobertos na planilha; campo `is_demo boolean` para produtos demonstrativos.
- `system_settings`: chave-valor JSON por organização (regra de elegibilidade configurável: recorrente / inicial / maior das duas; taxas projetadas; % máximo recomendado de comprometimento; frequência de reajuste; identidade visual).
- `simulations` grava snapshots (`product_snapshot`, `assumptions_snapshot` JSON) — simulação nunca muda retroativamente.
- RLS em todas as tabelas por `organization_id`; papel `consultant` restrito aos próprios clientes/oportunidades; `admin`/`manager` veem a organização. Papéis: admin, manager, consultant.
- Estágios de oportunidade: Novo lead → Contato realizado → Diagnóstico → Simulação apresentada → Documentação → Proposta → Negociação → Venda concluída / Perdido.

Seed (desenvolvimento):
- Organização demo "Soren Consórcios"; 1 admin, 1 manager, 2 consultores.
- 63 produtos da planilha via importador (`pnpm import:xlsx references/consorcio.xlsx` — idempotente, dedup por código+categoria+prazo+carta, relatório de inseridos/atualizados/ignorados/inválidos/erros).
- ~8 produtos demo de veículo (`is_demo = true`, IPCA, prazos ≤ 60 meses) para testar a correção IPCA sem misturar aos produtos reais.
- 4 clientes fictícios da planilha (João Silva, Maria Souza, Carlos Pereira, JANDIRINHA) — apenas em desenvolvimento.
- Índices iniciais (IGP-M, IPCA, CDI, poupança) com origem "Taxa projetada configurada pelo administrador".

## 7. Elegibilidade e ranking

Regra base preservada da planilha: `regular_installment_amount <= monthly_available_amount`.

Classificação (prompt, seção 10):
- **Compatível**: recorrente ≤ disponível E primeira-12ª ≤ disponível.
- **Compatível com atenção**: recorrente ≤ disponível E primeira-12ª > disponível (nunca escondida do consultor).
- **Não compatível**: recorrente > disponível.

Regra configurável pelo admin (recorrente / inicial / maior das duas), sempre exibida na tela.

Ranking determinístico e explicável (sem IA opaca): pontuação ponderada por compatibilidade, valor da carta, folga mensal, categoria desejada, prazo desejado, taxa adm, parcelas. Primeiro resultado = "Plano recomendado", com justificativa visível. Destaques adicionais: maior carta, menor parcela, menor prazo, menor taxa, melhor equilíbrio carta×parcela.

## 8. Simulador financeiro

- Slider de tempo 0 → prazo do produto. Imóveis: IGP-M padrão; veículos: IPCA padrão.
- Fórmulas (prompt, seção 14): fator anual `(1+taxa)^ano`; parcela do mês usa o fator do ano contratual `floor((mes-1)/12)`; total pago = soma das parcelas corrigidas mês a mês (nunca última parcela × prazo); taxas mensais históricas por acumulação de fatores.
- Cenários: Conservador / Base / Agressivo / Personalizado (edição de taxa só para autorizados ou modo cenário identificado).
- Bloco "Premissas da simulação": índice, taxa, origem, data, frequência, tipo (histórica/projetada/manual), aviso de estimativa. Projeções nunca apresentadas como garantia.
- Comparação com investimentos: CDI, IPCA, poupança, taxa personalizada, consórcio corrigido. Modo A (aporte mensal = parcela; padrão) e Modo B (capital inicial = carta). FV com juros compostos; caso taxa zero tratado. Gráfico de evolução patrimonial + ressalva de que consórcio e investimento têm objetivos/riscos/liquidez diferentes.
- Componente `CdiCompoundSlider`: anos, taxa CDI, % do CDI (80–120%/custom), aporte mensal, valor inicial opcional, total aportado, rendimento, montante, gráfico anual, comparação com carta corrigida. Padrão "estimativa bruta" claramente identificada.
- Salvar simulação → snapshots + histórico do cliente. Resumo imprimível (página print-friendly do navegador; sem dependência de lib de PDF).

## 9. Telas

- **Novo atendimento** (tela principal, mais simples): nome (busca incremental de clientes existentes ou criação), renda mensal, valor disponível, categoria (imóvel/veículo/todas), prazo opcional. Resumo no topo: nome, renda, disponível, comprometimento, maior carta pagável, nº elegíveis, menor parcela, maior parcela compatível, folga, alerta de risco. Cards de resultado com filtros (categoria, administradora, carta, parcela, prazo, taxa, índice, só compatíveis) e botões Simular / Criar oportunidade.
- **Clientes** (CRM): lista com busca/filtros/ordenação; página individual com dados, resumo financeiro, simulações, oportunidades, timeline de interações, anotações, ações rápidas (nova simulação, oportunidade, registrar ligação/reunião, WhatsApp com mensagem pré-preenchida — sem envio automático, follow-up).
- **Pipeline**: Kanban com drag-and-drop entre estágios, cards com cliente/consultor/produto/carta/parcela/último contato/follow-up/probabilidade/tempo no estágio, motivo de perda, filtros.
- **Dashboard comercial**: KPIs e gráficos do prompt (seção 21), 100% dados do banco, filtros de período e consultor.
- **Base de Produtos** (admin, Fase 6): upload drag-and-drop de PDFs, pipeline upload→hash→extração→normalização→validação→revisão humana→publicação. Nunca publica sem revisão; página de origem + confiança de extração; OCR fallback; campos não identificados ficam pendentes (nunca inventados); revisão lado a lado documento × dados; mapeamento manual de colunas; dedup; versionamento.
- **Configurações** (admin): taxas projetadas, regra de elegibilidade, comprometimento máximo, índices financeiros (cadastro manual, preparado para SGS/Bacen; cache; nunca bloquear simulação por API externa fora do ar).

## 10. Segurança e LGPD

RLS em tudo; validação server-side (Zod) em toda entrada; proteção de rotas por sessão + papel; limite de tamanho/tipo de arquivo, sanitização de nomes, verificação de MIME; `audit_logs` (usuário, ação, entidade, estado anterior/posterior, timestamp, IP); isolamento entre organizações testado; exclusão lógica/anonimização de clientes; segredos apenas em env (`.env.example` documentado, `.env` jamais commitado); nenhuma chave privada no frontend.

## 11. Testes

- **Vitest (unitários)**: os 20 casos do prompt (seção 27) + testes-oráculo contra a planilha (parcelas exatas dos 63 produtos; maior carta/contagem dos 4 clientes).
- **Playwright (E2E)**: login, cadastro de cliente, nova simulação, seleção de produto, slider, salvar simulação, criar oportunidade, upload/revisão de PDF (Fase 6), dashboard.
- Gate por fase: `pnpm lint && pnpm typecheck && pnpm test` verdes antes de avançar; `pnpm test:e2e && pnpm build` nas fases 5–7.

## 12. Fases de execução

| Fase | Conteúdo | Gate |
|---|---|---|
| 1 Fundação | Análise da planilha (`ANALISE_PLANILHA.md`), scaffold, Supabase local, migrations, auth, perfis, RLS, layout base, docs de planejamento (`AGENTS.md`, `PLANS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `CALCULATIONS.md`) | lint+typecheck+test |
| 2 Produtos | CRUD, importador XLSX idempotente, listagem, filtros, ativação | idem + oráculo planilha |
| 3 Atendimento | Clientes, busca, Novo atendimento, elegibilidade, ranking, cards | idem |
| 4 Simulador | IGP-M/IPCA/CDI, sliders, gráficos, premissas, cenários, snapshots, resumo imprimível | idem |
| 5 CRM | Oportunidades, Kanban, interações, follow-ups, dashboard | idem + E2E |
| 6 PDF | Upload, extração, OCR, revisão, publicação, versionamento | idem + E2E |
| 7 Qualidade | Testes completos, segurança, responsividade, performance, README/docs, build final | todos os critérios de aceite (seção 32 do prompt) |

Fluxo por task: agente **Sonnet 5** implementa → **Fable 5** revisa o diff e corrige → testes → commit. `PLANS.md` atualizado e push para o GitHub ao fim de cada fase (branch `main`).

## 13. Fora de escopo deste ciclo

- Identidade visual/design final (sessão conjunta com o usuário ao final; UI neutra shadcn até lá).
- Deploy em produção (Vercel documentado, não executado).
- Envio automático de mensagens (WhatsApp apenas link pré-preenchido).
- Integração ativa com SGS/Bacen (camada preparada; índices econômicos cadastrados manualmente pelo admin, com origem e data sempre exibidas).
- Módulo de documentos do cliente (fase futura, conforme prompt).

## 14. Riscos técnicos

1. **Extração de PDF heterogêneo (F6)** — maior risco; mitigado por revisão humana obrigatória, confiança por campo e mapeamento manual. Isolado na última fase de produção.
2. **Precisão financeira** — mitigado por decimal.js + NUMERIC + testes-oráculo da planilha.
3. **RLS mal configurado** — mitigado por testes de isolamento (consultor×consultor, org×org) exigidos no prompt.
4. **Supabase local depende de Docker ativo** — documentar pré-requisito; scripts de bootstrap.
5. **Volume de fases** — mitigado por gates por fase e commits atômicos; MVP utilizável já na F5.

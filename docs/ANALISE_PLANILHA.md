# Análise da Planilha de Referência (`references/consorcio.xlsx`)

**Fase:** 1 — Fundação
**Objetivo:** documentar, por engenharia reversa, todas as regras de negócio embutidas na planilha original, de modo que sirvam de especificação executável (oráculo de testes) para as fases 2–4 do sistema.

A planilha não contém nenhuma documentação textual das fórmulas — apenas os valores calculados. As fórmulas abaixo foram deduzidas comparando colunas de entrada/saída e confirmadas por verificação numérica exaustiva (todas as 63 linhas da aba Consórcios e os 4 clientes cadastrados), com script Python (`openpyxl`, `data_only=True`) rodado sobre o arquivo original.

---

## 1. Inventário das 5 abas

| Aba | Dimensão | Propósito |
|---|---|---|
| **Consórcios** | 64 linhas × 7 colunas (63 produtos + cabeçalho) | Tabela mestre de produtos de consórcio de imóvel. Única aba que contém dados de origem (produto); todas as demais derivam dela. |
| **Clientes** | 4 linhas de dados (de até 1000 possíveis) × 4 colunas | Cadastro simplificado de clientes: nome + valor disponível mensal ("dividendo mensal"), com colunas calculadas (maior carta pagável, produtos elegíveis). |
| **Oportunidades** | 9.450 linhas de dados × 18 colunas | Produto cartesiano **clientes × produtos** (4 clientes × 63 produtos × múltiplas linhas de layout ≈ resultado observado), com folga mensal e flag de elegibilidade, ordenado por maior folga. É uma visão **derivada**, recalculada a partir de Clientes + Consórcios. |
| **Cartões** | 962 linhas × 10 colunas | Visão "cartão" por cliente: para cada cliente, resumo (dividendo, maior carta pagável, produtos que cabem) + lista Top 10 produtos por maior parcela que ainda cabe no dividendo. Também derivada. |
| **Dashboard** | 80 linhas × 20 colunas | Tela de consulta única: seletor de cliente (dropdown), resumo rápido (maior carta pagável, produtos que cabem, menor parcela, maior parcela que cabe, comprometimento máximo, carta recomendada) e lista de produtos elegíveis ordenada por parcela decrescente. Também derivada — não tem dados próprios, é uma visão calculada sobre Consórcios + Clientes. |

**Conclusão estrutural:** apenas **Consórcios** e **Clientes** são fontes de dados primárias. **Dashboard**, **Cartões** e **Oportunidades** são visualizações/relatórios recalculados a partir dessas duas — no sistema novo elas não geram tabelas próprias no banco; são views/queries sobre `consortium_products` + `clients` (ou telas do próprio app).

---

## 2. Estrutura da tabela de produtos (aba Consórcios)

Colunas (cabeçalho da linha 1):

| Coluna | Nome | Exemplo (linha 2) |
|---|---|---|
| A | Produto | `Imóvel IE600 – 240m` |
| B | Código | `IE600` |
| C | Valor da Carta (R$) | `600000` |
| D | Prazo (meses) | `240` |
| E | Taxa Adm Total (%) | `0,268` (26,8%) |
| F | Parcela 1ª a 12ª (R$) | `3820` |
| G | Parcela Mensal (R$) | `3220` |

**63 produtos no total** = **21 códigos distintos** (`IE120, IE130, IE140, IE150, IE200, IE220, IE230, IE240, IE300, IE330, IE350, IE380, IE400, IE430, IE450, IE480, IE500, IE530, IE550, IE580, IE600`) **× 3 prazos** (200 / 220 / 240 meses).

Valores de carta distintos (21, em R$): 120.000 · 130.000 · 140.000 · 150.000 · 200.000 · 220.000 · 230.000 · 240.000 · 300.000 · 330.000 · 350.000 · 380.000 · 400.000 · 430.000 · 450.000 · 480.000 · 500.000 · 530.000 · 550.000 · 580.000 · 600.000.

Correlação prazo ↔ taxa administrativa total (fixa, 1:1):

| Prazo | Taxa Adm Total |
|---|---|
| 200 meses | 24,8% |
| 220 meses | 25,8% |
| 240 meses | 26,8% |

Todos os 63 produtos são da categoria **imóvel** (não há veículo na planilha original — os produtos de veículo do seed de desenvolvimento são demonstrativos, criados pelo sistema, não importados da planilha).

---

## 3. Fórmulas descobertas (com verificação)

As fórmulas não aparecem como texto na planilha (apenas os valores resultantes). Foram deduzidas por engenharia reversa e confirmadas contra **as 63 linhas** de produtos, com 0 divergências:

```
parcela_mensal   = carta × (1 + taxa_adm + 0,02) ÷ prazo
parcela_1a_a_12a = parcela_mensal + 0,001 × carta
```

- `0,02` (2%) é um fundo de reserva implícito, somado à taxa administrativa total antes de dividir pelo prazo. Não está identificado como coluna na planilha — foi inferido batendo o valor calculado contra a `Parcela Mensal (R$)` publicada.
- `0,001 × carta` (0,1% da carta) é o acréscimo aplicado apenas nas 12 primeiras parcelas (provavelmente taxa de adesão/seguro diluída no primeiro ano).

**Verificações pontuais** (conferidas manualmente e por script):

| Produto | Cálculo | Resultado esperado | Planilha |
|---|---|---|---|
| IE580 – 240m | 580.000 × (1 + 0,268 + 0,02) ÷ 240 = 580.000 × 1,288 ÷ 240 | 3.112,67 | 3.112,67 ✓ |
| IE600 – 240m | 600.000 × 1,288 ÷ 240 | 3.220,00 | 3.220,00 ✓ |
| IE600 – 240m (1ª–12ª) | 3.220,00 + 0,001 × 600.000 = 3.220,00 + 600,00 | 3.820,00 | 3.820,00 ✓ |

**Verificação exaustiva por script** (`openpyxl`, `data_only=True`, todas as 63 linhas da aba Consórcios): 0 divergências entre `parcela_mensal`/`parcela_1a_a_12a` calculados pelas fórmulas acima e os valores publicados na planilha (arredondamento a 2 casas decimais).

### Fórmulas de elegibilidade (abas Clientes / Oportunidades / Dashboard)

```
maior_carta_pagavel = MAXIFS(carta; parcela_mensal <= dividendo)
produtos_elegiveis  = COUNTIFS(parcela_mensal <= dividendo)
folga                = dividendo − parcela
elegivel              = parcela <= dividendo   (1 = compatível, 0 = não compatível)
```

- Regra base de elegibilidade preservada no sistema novo: `regular_installment_amount <= monthly_available_amount`.
- Ordenação da aba Oportunidades: maior `folga` primeiro (ranking mais simples de "melhor encaixe").
- Aba Cartões: Top 10 produtos por cliente ordenados por **maior parcela que ainda cabe** no dividendo (ou seja, maior parcela ≤ dividendo → maximiza o uso da capacidade de pagamento).

---

## 4. Oráculo de testes (dados reais da planilha)

Verificado por script contra as 63 linhas da aba Consórcios, reproduzindo exatamente os valores publicados nas abas Dashboard/Cartões/Clientes:

| Cliente | Dividendo mensal (R$) | Maior carta pagável (R$) | Produtos elegíveis |
|---|---|---|---|
| João Silva | 1.500 | 240.000 | 23 |
| Maria Souza | 3.200 | 580.000 | 56 |
| Carlos Pereira | 800 | 140.000 | 6 |
| JANDIRINHA | 4.550 | 600.000 | 63 |

Estes 4 registros são a totalidade da aba Clientes (as demais ~996 linhas da faixa `A1:D1000` estão vazias — não são dados, são apenas o intervalo formatado da planilha). Servem como oráculo de teste (fixtures) para os testes unitários de `getEligibleProducts`, `calculateMonthlySlack` e do importador XLSX nas fases 2–4.

Exemplo de dado adicional de apoio, extraído da aba Dashboard para JANDIRINHA (dividendo 4.550): comprometimento máximo = 0,836044 (83,60%), carta recomendada = "Imóvel IE600 – 240m", menor parcela (entrada) = 644,00 (produto `IE120 – 240m`), maior parcela que cabe = 3.804,00 (produto `IE600 – 200m`).

---

## 5. Observações

- **A planilha NÃO possui campo de renda mensal** — apenas o "dividendo mensal" (valor disponível para a parcela). O sistema novo mantém os dois campos deliberadamente separados e nunca como sinônimos:
  - `monthly_income` (renda mensal do cliente — dado novo, não existe na planilha, coletado na tela "Novo atendimento");
  - `monthly_available_amount` (equivalente exato ao "dividendo mensal" da planilha — usado nas fórmulas de elegibilidade).
- **Abas Cartões, Dashboard e Oportunidades são visualizações derivadas**, não fontes de dados: no sistema, não geram tabelas próprias — a lógica equivalente é recalculada sob demanda (server-side) a partir de `clients` + `consortium_products`, nas telas "Novo atendimento" e "Dashboard comercial".
- A planilha cobre **apenas produtos de imóvel** — os ~8 produtos de veículo (IPCA, prazos ≤ 60 meses) do seed de desenvolvimento são demonstrativos (`is_demo = true`), não importados da planilha, criados apenas para validar a correção por IPCA sem misturar com os dados reais importados.
- Os valores de "Taxa Adm Total" (24,8/25,8/26,8%) e o fundo de reserva implícito de 2% não têm origem/data documentada na planilha — no sistema novo, nenhuma taxa é hardcoded: são armazenadas em `financial_indexes`/`system_settings` com origem e data, mesmo os valores importados como "herdados da planilha original".
- A aba Oportunidades soma ~9.450 linhas por ser o produto cartesiano de todos os clientes cadastrados (incluindo linhas de layout/cabeçalho intercaladas por bloco) × os 63 produtos; não deve ser confundida com uma tabela de CRM real — o CRM de oportunidades do sistema novo é uma entidade própria (`opportunities`), criada manualmente pelo consultor a partir de uma simulação, não por produto cartesiano automático.
- Arredondamento: todos os valores monetários da planilha estão arredondados a 2 casas decimais; o sistema novo deve usar `NUMERIC(14,2)` no Postgres e `decimal.js` no domínio para evitar erros de ponto flutuante binário (confirmado necessário: alguns valores de "folga" na planilha aparecem com resíduo de ponto flutuante, ex. `1985.4499999999998` em vez de `1985,45`, evidência de que a planilha original já sofre desse problema).

---

## 6. Mapeamento planilha → banco (`consortium_products`)

| Coluna da planilha (aba Consórcios) | Campo em `consortium_products` | Observação |
|---|---|---|
| Produto (`A`) | `product_name` | Ex.: `Imóvel IE600 – 240m` |
| Código (`B`) | `product_code` | Ex.: `IE600` — repetido 3× (um por prazo); chave de dedup do importador é `product_code + category + term_months + credit_amount` |
| Valor da Carta (`C`) | `credit_amount` | `NUMERIC(14,2)`; 21 valores distintos, 120.000–600.000 |
| Prazo em meses (`D`) | `term_months` | 200 / 220 / 240 |
| Taxa Adm Total (`E`) | `total_administration_fee_percent` | `NUMERIC(6,3)`, armazenado em pontos percentuais (ex.: `26.800` para 26,8%), não fração |
| Parcela 1ª a 12ª (`F`) | `first_12_installment_amount` | Recalculável, mas importado como veio da planilha (auditoria). A planilha só fornece a faixa agregada 1ª–12ª, não a 1ª parcela isolada |
| Parcela Mensal (`G`) | `regular_installment_amount` | Recalculável, mas importado como veio da planilha (auditoria) |
| *(não existe na planilha)* | `first_installment_amount` | Campo separado do schema para a 1ª parcela isolada — a planilha não distingue a 1ª parcela da faixa 1ª–12ª, então este campo fica `NULL` na importação (nenhum dado de origem para preenchê-lo) |
| *(implícito, não é coluna)* | `reserve_fund_percent` | Preenchido com `2.000` (2%) — o fundo de reserva descoberto por engenharia reversa, não uma coluna original |
| *(não existe na planilha — todos os produtos são imóvel)* | `category` | Preenchido como `'property'` para os 63 produtos importados; produtos de veículo do seed usam `'vehicle'` e `is_demo = true` |
| *(não existe na planilha)* | `is_demo` | `false` para os 63 produtos reais importados; `true` para os produtos demonstrativos de veículo |
| *(não existe na planilha)* | `organization_id` | Atribuído no momento da importação à organização demo "Soren Consórcios" |
| *(não existe na planilha)* | `status` | Enum `product_status` (`draft`/`active`/`inactive`/`archived`); todos os produtos importados nascem `'active'` |

O importador (`pnpm import:xlsx references/consorcio.xlsx`, Fase 2) deve ser **idempotente**: reexecuções não duplicam produtos (dedup pela chave composta `product_code + category + term_months + credit_amount`) e produzem um relatório de inseridos/atualizados/ignorados/inválidos/erros.

# CALCULATIONS.md

Fórmulas de negócio do sistema: (1) as descobertas por engenharia reversa da planilha original (`docs/ANALISE_PLANILHA.md`, implementadas desde a Fase 2), e (2) as fórmulas de correção/comparação com investimentos definidas na spec (seção 8), que serão implementadas na **Fase 4 (Simulador)**. Nenhuma fórmula abaixo está implementada ainda em código nesta Fase 1 — este documento é a especificação executável para quando forem escritas em `src/domain`.

Notação: valores monetários em R$, taxas em fração decimal salvo indicação contrária, `carta` = valor do crédito contratado, `prazo` = número de meses do plano.

---

## 1. Fórmulas da planilha (produtos de consórcio) — Fase 2

Fonte: `docs/ANALISE_PLANILHA.md`, seção 3. Confirmadas contra as 63 linhas da aba **Consórcios**, 0 divergências.

```
parcela_mensal   = carta × (1 + taxa_adm + 0,02) ÷ prazo
parcela_1a_a_12a = parcela_mensal + 0,001 × carta
```

- `taxa_adm` = `total_administration_fee_percent` (fração; ex.: 26,8% → `0.268`).
- `0,02` (2%) = fundo de reserva implícito (`reserve_fund_percent`), somado à taxa administrativa total antes de dividir pelo prazo.
- `0,001 × carta` (0,1% da carta) = acréscimo aplicado apenas nas parcelas 1ª–12ª.

### Exemplos numéricos (oráculo)

| Produto | Cálculo | Resultado |
|---|---|---|
| IE580 – 240m | `580.000 × (1 + 0,268 + 0,02) ÷ 240` = `580.000 × 1,288 ÷ 240` | `3.112,67` |
| IE600 – 240m | `600.000 × 1,288 ÷ 240` | `3.220,00` |
| IE600 – 240m (1ª–12ª) | `3.220,00 + 0,001 × 600.000` = `3.220,00 + 600,00` | `3.820,00` |

## 2. Elegibilidade — Fase 3

Fonte: `docs/ANALISE_PLANILHA.md`, seção 3, e spec seção 7.

```
maior_carta_pagavel = MAXIFS(carta; parcela_mensal <= dividendo)
produtos_elegiveis   = COUNTIFS(parcela_mensal <= dividendo)
folga                = dividendo − parcela
elegivel             = parcela <= dividendo
```

- `dividendo` = `monthly_available_amount` do cliente.
- Regra base preservada no sistema novo: `regular_installment_amount <= monthly_available_amount`.

### Classificação (spec, seção 7)

- **Compatível**: `regular_installment_amount <= disponível` **e** `first_12_installment_amount <= disponível`.
- **Compatível com atenção**: `regular_installment_amount <= disponível` **e** `first_12_installment_amount > disponível` (nunca escondida do consultor).
- **Não compatível**: `regular_installment_amount > disponível`.

A regra de qual parcela usar como base de elegibilidade (recorrente / inicial / maior das duas) é configurável pelo admin via `system_settings`, sempre exibida na tela para o consultor.

### Exemplos numéricos (oráculo — clientes da planilha)

| Cliente | Dividendo (R$) | Maior carta pagável (R$) | Produtos elegíveis |
|---|---|---|---|
| João Silva | 1.500 | 240.000 | 23 |
| Maria Souza | 3.200 | 580.000 | 56 |
| Carlos Pereira | 800 | 140.000 | 6 |
| JANDIRINHA | 4.550 | 600.000 | 63 |

Dado de apoio (aba Dashboard, JANDIRINHA): comprometimento máximo = `0,836044` (83,60%), carta recomendada = "Imóvel IE600 – 240m", menor parcela (entrada) = `644,00` (IE120–240m), maior parcela que cabe = `3.804,00` (IE600–200m).

## 3. Correção de índices (IGP-M/IPCA) — Fase 4

Fonte: spec, seção 8 (fórmulas do prompt, seção 14).

- Slider de tempo: `0 → prazo do produto` (meses).
- Fator anual de correção: `(1 + taxa_anual)^ano`.
- A parcela de um mês usa o fator do **ano contratual** daquele mês: `ano_contratual = floor((mes - 1) / 12)`.
- Índice padrão por categoria: **imóveis → IGP-M**; **veículos → IPCA**.

```
fator(ano)               = (1 + taxa_anual)^ano
carta_corrigida(mes)      = carta_base × fator(floor((mes-1)/12))
parcela_corrigida(mes)    = parcela_base × fator(floor((mes-1)/12))
total_pago_projetado      = Σ parcela_corrigida(mes), mes = 1..prazo
```

**Importante**: `total_pago_projetado` é sempre a soma das parcelas corrigidas mês a mês — **nunca** `ultima_parcela × prazo` (isso subestimaria ou superestimaria o total ao ignorar a progressão ano a ano).

### Exemplo numérico

Produto IE600–240m (`carta` = 600.000, `parcela_mensal` = 3.220,00), corrigido por IGP-M projetado de 5% a.a.:

- Ano 0 (meses 1–12): fator = `(1,05)^0 = 1`; parcela = `3.220,00`.
- Ano 1 (meses 13–24): fator = `(1,05)^1 = 1,05`; parcela = `3.220,00 × 1,05 = 3.381,00`.
- Ano 2 (meses 25–36): fator = `(1,05)^2 = 1,1025`; parcela = `3.220,00 × 1,1025 = 3.550,05`.

## 4. Comparação com investimentos (CDI/poupança/personalizada) — Fase 4

Fonte: spec, seção 8. Dois modos:

- **Modo A (padrão)** — aporte mensal constante = valor da parcela do consórcio.
- **Modo B** — capital inicial único = valor da carta.

### Valor futuro de capital único (juros compostos)

```
FV = principal × (1 + taxa_mensal)^n_meses
```

### Valor futuro de aportes mensais (Modo A)

```
FV = aporte × [ ((1 + taxa_mensal)^n_meses − 1) ÷ taxa_mensal ]      # taxa_mensal ≠ 0
FV = aporte × n_meses                                                  # taxa_mensal = 0 (caso especial, evita divisão por zero)
```

- `taxa_mensal` é derivada da taxa anual/CDI configurada (com origem e data, nunca hardcoded) — conversão de taxa anual para mensal por juros compostos: `taxa_mensal = (1 + taxa_anual)^(1/12) − 1`.
- Componente `CdiCompoundSlider`: parâmetros — anos, taxa CDI, `% do CDI` (80–120% ou customizado), aporte mensal, valor inicial opcional. Saídas: total aportado, rendimento (`FV − total aportado`), montante final, série anual para gráfico, comparação lado a lado com a carta corrigida do consórcio. Sempre identificado como "estimativa bruta" na UI — projeções nunca apresentadas como garantia.

### Exemplo numérico (Modo A, taxa mensal simples)

Aporte mensal = `3.220,00` (parcela do IE600–240m), taxa mensal = `0,8%` (~10,03% a.a.), 12 meses:

```
FV = 3.220,00 × [ ((1,008)^12 − 1) ÷ 0,008 ]
   = 3.220,00 × [ (1,10029 − 1) ÷ 0,008 ]
   = 3.220,00 × 12,536
   ≈ 40.367,79
```

Total aportado em 12 meses = `3.220,00 × 12 = 38.640,00`; rendimento ≈ `1.727,79`.

## 5. Funções de domínio mínimas (spec, seção 5)

A implementar em `src/domain` conforme as fases acima consomem cada uma:

`getEligibleProducts`, `calculateMonthlySlack`, `calculateIncomeCommitment`, `rankConsortiumProducts` (Fase 3); `calculateCorrectedCredit`, `calculateCorrectedInstallment`, `calculateCorrectedPaymentSchedule`, `calculateTotalProjectedPayments`, `calculateCompoundFutureValue`, `calculateMonthlyContributionFutureValue`, `compareConsortiumAndInvestments` (Fase 4).

Todas usam `decimal.js` internamente; nenhuma opera sobre `number` bruto para valores monetários ou percentuais.

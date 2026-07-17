# Fase 4 — Simulador Financeiro: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simulador financeiro completo: correção IGP-M/IPCA por ano de contrato, sliders de tempo, CDI com juros compostos, comparação consórcio × investimentos, cenários e premissas, e simulações salvas com snapshot imutável.

**Architecture:** Todas as fórmulas em `src/domain/financial-calculations` (funções puras, decimal.js, exaustivamente testadas). Os sliders recalculam NO CLIENTE usando essas mesmas funções puras (sem round-trip). Salvar simulação passa por service → repository, gravando `product_snapshot` + `assumptions_snapshot` (JSON) para imutabilidade. Taxas nunca hardcoded: vêm de `financial_indexes`/`system_settings` com origem e data.

**Tech Stack:** decimal.js, Recharts (gráficos), Zod, shadcn/ui (slider). Adiciona `recharts` e o componente `slider` do shadcn.

## Global Constraints (valem para TODAS as tasks)

- TypeScript `strict: true`; lint limpo; pnpm. Diretório: `/Users/kaiobp/Documents/Soren-Consorcio-dashboard` (git, `main`).
- Fórmulas financeiras SÓ em `src/domain/financial-calculations` — componentes React NUNCA calculam correção/juros; importam as funções puras.
- decimal.js em todo cálculo; dinheiro como string canônica "1234.56". Taxas anuais trafegam como **pontos percentuais em string** ("6.5" = 6,5% a.a.) e são convertidas para fração internamente (`.div(100)`).
- Nenhuma taxa hardcoded: origem sempre de `financial_indexes`/`system_settings`, exibida com origem e data. Projeção NUNCA apresentada como garantia (aviso de estimativa em toda tela de simulação).
- Snapshot: simulação salva não muda quando produto/taxa é editado depois (`product_snapshot`/`assumptions_snapshot` JSON).
- UI neutra shadcn, pt-BR, `formatCurrency`/`formatPercent`/`formatDate` de `src/lib/format.ts`. shadcn usa `@base-ui/react` (prop `render`; dialog fecha por comparação de estado em render, não setState-em-useEffect).
- Server Actions validam com Zod; banco só via `src/repositories/`.
- Supabase local API 54331 (`.env.local`); usuários demo admin@/ana@demo.soren.com.br senha demo12345; banco com 63 produtos property (IGP-M) + 8 vehicle demo (IPCA). Índices no seed: IGPM 6.5, IPCA 4.5, CDI 10.5, SAVINGS 6.2 (projected=true, origem "Taxa projetada configurada pelo administrador").
- Commits pt-BR convencional terminando com: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Prompt §14 (correção), §16 (investimentos), §17 (CDI), §26 (funções), §27 (testes 8–14, 19–20).

---

### Task 1: Núcleo de correção — fatores, carta e parcela corrigidas

**Files:**
- Create: `src/domain/financial-calculations/correction.ts`, `src/domain/financial-calculations/correction.test.ts`

**Interfaces:**
- Produces:

```ts
/** Fator de correção anual: (1 + taxaAnual)^ano. rate em pontos percentuais ("6.5"). */
export function annualCorrectionFactor(annualRatePercent: string, year: number): string; // 6 casas
/** Índice do ano de contrato de um mês (0-based): floor((mes-1)/12). */
export function contractYearOfMonth(month: number): number;
/** Carta corrigida no ano: base × (1 + taxa)^ano. */
export function calculateCorrectedCredit(baseCredit: string, annualRatePercent: string, year: number): string; // 2 casas
/** Parcela corrigida no ANO informado: base × (1 + taxa)^ano. */
export function calculateCorrectedInstallment(baseInstallment: string, annualRatePercent: string, year: number): string; // 2 casas
/** Parcela do MÊS: base × (1 + taxa)^floor((mes-1)/12). */
export function correctedInstallmentForMonth(baseInstallment: string, annualRatePercent: string, month: number): string; // 2 casas
```

- [ ] **Step 1: Instalar (nenhuma nova aqui; decimal.js já existe).** Confirmar `decimal.js` em package.json.

- [ ] **Step 2: Teste que falha** — `correction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  annualCorrectionFactor, calculateCorrectedCredit, calculateCorrectedInstallment,
  contractYearOfMonth, correctedInstallmentForMonth,
} from "./correction";

describe("contractYearOfMonth (prompt §14)", () => {
  it("mês 1–12 → ano 0; mês 13 → ano 1; mês 240 → ano 19", () => {
    expect(contractYearOfMonth(1)).toBe(0);
    expect(contractYearOfMonth(12)).toBe(0);
    expect(contractYearOfMonth(13)).toBe(1);
    expect(contractYearOfMonth(240)).toBe(19);
  });
});

describe("annualCorrectionFactor", () => {
  it("ano 0 = 1 (sem correção)", () => {
    expect(annualCorrectionFactor("6.5", 0)).toBe("1.000000");
  });
  it("IGP-M 6,5% no ano 1 e 2", () => {
    expect(annualCorrectionFactor("6.5", 1)).toBe("1.065000");
    expect(annualCorrectionFactor("6.5", 2)).toBe("1.134225");
  });
  it("taxa zero mantém fator 1 em qualquer ano (caso 10 do prompt)", () => {
    expect(annualCorrectionFactor("0", 8)).toBe("1.000000");
  });
});

describe("calculateCorrectedCredit (caso 8: IGP-M)", () => {
  it("carta 600.000 corrigida por IGP-M 6,5% no ano 8", () => {
    // 600000 × 1.065^8 = 992997.40
    expect(calculateCorrectedCredit("600000.00", "6.5", 8)).toBe("992997.40");
  });
  it("taxa zero não altera a carta (caso 10)", () => {
    expect(calculateCorrectedCredit("600000.00", "0", 8)).toBe("600000.00");
  });
});

describe("calculateCorrectedInstallment (caso 9: IPCA)", () => {
  it("parcela 1.902 corrigida por IPCA 4,5% no ano 3", () => {
    // 1902 × 1.045^3 = 1902 × 1.141166... = 2170.50
    expect(calculateCorrectedInstallment("1902.00", "4.5", 3)).toBe("2170.50");
  });
});

describe("correctedInstallmentForMonth", () => {
  it("mês 1 usa ano 0 (parcela base)", () => {
    expect(correctedInstallmentForMonth("1902.00", "4.5", 1)).toBe("1902.00");
  });
  it("mês 13 usa ano 1", () => {
    expect(correctedInstallmentForMonth("1902.00", "4.5", 13)).toBe("1987.59");
  });
});
```

(Os valores esperados acima foram pré-calculados; o implementador deve confirmar que `decimal.js` os reproduz — se houver diferença de arredondamento na última casa, ajustar o VALOR ESPERADO para o que a fórmula correta produz, documentando o cálculo, nunca alterando a fórmula.)

- [ ] **Step 3: Rodar e ver falhar.**

- [ ] **Step 4: Implementar** — `correction.ts`:

```ts
import Decimal from "decimal.js";

function rateFraction(annualRatePercent: string): Decimal {
  return new Decimal(annualRatePercent).div(100);
}

export function contractYearOfMonth(month: number): number {
  return Math.floor((month - 1) / 12);
}

export function annualCorrectionFactor(annualRatePercent: string, year: number): string {
  return new Decimal(1).plus(rateFraction(annualRatePercent)).pow(year).toFixed(6);
}

export function calculateCorrectedCredit(baseCredit: string, annualRatePercent: string, year: number): string {
  const factor = new Decimal(1).plus(rateFraction(annualRatePercent)).pow(year);
  return new Decimal(baseCredit).times(factor).toFixed(2, Decimal.ROUND_HALF_UP);
}

export function calculateCorrectedInstallment(baseInstallment: string, annualRatePercent: string, year: number): string {
  const factor = new Decimal(1).plus(rateFraction(annualRatePercent)).pow(year);
  return new Decimal(baseInstallment).times(factor).toFixed(2, Decimal.ROUND_HALF_UP);
}

export function correctedInstallmentForMonth(baseInstallment: string, annualRatePercent: string, month: number): string {
  return calculateCorrectedInstallment(baseInstallment, annualRatePercent, contractYearOfMonth(month));
}
```

- [ ] **Step 5: Rodar** → PASS. **Step 6: Commit** — `feat: núcleo de correção financeira (fatores anuais, carta e parcela corrigidas)`

---

### Task 2: Cronograma de pagamentos e total projetado

**Files:**
- Create: `src/domain/financial-calculations/schedule.ts`, `src/domain/financial-calculations/schedule.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:

```ts
export type ScheduleEntry = { month: number; year: number; installment: string };
export type YearlyPoint = { year: number; correctedInstallment: string; correctedCredit: string; cumulativePaid: string };
/** Parcela mês a mês do 1 até termMonths (ou até untilMonth, se informado ≤ term). */
export function calculateCorrectedPaymentSchedule(baseInstallment: string, annualRatePercent: string, termMonths: number, untilMonth?: number): ScheduleEntry[];
/** Total pago = soma das parcelas corrigidas do mês 1 até untilMonth (NUNCA última parcela × prazo). */
export function calculateTotalProjectedPayments(baseInstallment: string, annualRatePercent: string, untilMonth: number): string; // 2 casas
/** Série anual para gráficos: um ponto por ano de contrato até termMonths. */
export function buildYearlySeries(baseInstallment: string, baseCredit: string, annualRatePercent: string, termMonths: number): YearlyPoint[];
```

- [ ] **Step 1: Testes que falham** — `schedule.test.ts`, cobrindo:
  1. **Total pago soma parcela a parcela** (não última × prazo): com taxa 0, parcela 1.000, 12 meses → "12000.00"; com IGP-M 6,5%, 24 meses, verificar que total = soma(12×base + 12×base×1.065) e ≠ base×24;
  2. **Caso 14 (limite pelo prazo)**: `untilMonth` > termMonths deve ser tratado — `calculateCorrectedPaymentSchedule` limita a `termMonths` (schedule.length === termMonths mesmo com untilMonth=999);
  3. **Taxa zero**: schedule com todas as parcelas iguais à base;
  4. **buildYearlySeries**: termMonths 240 → 20 pontos (anos 0–19), cumulativePaid crescente e monotônico, último ponto = total do plano.

  Escrever os testes completos com valores explícitos calculados via decimal.

- [ ] **Step 2: FAIL → Step 3: Implementar** `schedule.ts`:

```ts
import Decimal from "decimal.js";
import { calculateCorrectedInstallment, contractYearOfMonth, correctedInstallmentForMonth } from "./correction";

export type ScheduleEntry = { month: number; year: number; installment: string };
export type YearlyPoint = { year: number; correctedInstallment: string; correctedCredit: string; cumulativePaid: string };

export function calculateCorrectedPaymentSchedule(
  baseInstallment: string, annualRatePercent: string, termMonths: number, untilMonth?: number,
): ScheduleEntry[] {
  const last = Math.min(untilMonth ?? termMonths, termMonths);
  const entries: ScheduleEntry[] = [];
  for (let m = 1; m <= last; m++) {
    entries.push({ month: m, year: contractYearOfMonth(m), installment: correctedInstallmentForMonth(baseInstallment, annualRatePercent, m) });
  }
  return entries;
}

export function calculateTotalProjectedPayments(baseInstallment: string, annualRatePercent: string, untilMonth: number): string {
  const schedule = calculateCorrectedPaymentSchedule(baseInstallment, annualRatePercent, untilMonth, untilMonth);
  const total = schedule.reduce((acc, e) => acc.plus(e.installment), new Decimal(0));
  return total.toFixed(2, Decimal.ROUND_HALF_UP);
}

export function buildYearlySeries(
  baseInstallment: string, baseCredit: string, annualRatePercent: string, termMonths: number,
): YearlyPoint[] {
  const totalYears = Math.ceil(termMonths / 12);
  const points: YearlyPoint[] = [];
  let cumulative = new Decimal(0);
  for (let m = 1; m <= termMonths; m++) {
    cumulative = cumulative.plus(correctedInstallmentForMonth(baseInstallment, annualRatePercent, m));
    const isYearEnd = m % 12 === 0 || m === termMonths;
    if (isYearEnd) {
      const year = contractYearOfMonth(m);
      points.push({
        year,
        correctedInstallment: calculateCorrectedInstallment(baseInstallment, annualRatePercent, year),
        correctedCredit: new Decimal(baseCredit).times(new Decimal(1).plus(new Decimal(annualRatePercent).div(100)).pow(year)).toFixed(2, Decimal.ROUND_HALF_UP),
        cumulativePaid: cumulative.toFixed(2, Decimal.ROUND_HALF_UP),
      });
    }
  }
  void totalYears;
  return points;
}
```

(Se `buildYearlySeries` produzir pontos duplicados quando termMonths for múltiplo de 12 e a última iteração coincidir, o implementador deve garantir 1 ponto por ano — ajustar a condição para não duplicar o último ano.)

- [ ] **Step 4: PASS → Step 5: Commit** — `feat: cronograma de pagamentos corrigidos e total projetado por soma mensal`

---

### Task 3: Valor futuro de investimentos (aporte mensal e capital inicial)

**Files:**
- Create: `src/domain/financial-calculations/investment.ts`, `src/domain/financial-calculations/investment.test.ts`

**Interfaces:**
- Produces:

```ts
/** Taxa mensal equivalente a partir da anual: (1 + taxaAnual)^(1/12) − 1. Retorna fração string 8 casas. */
export function monthlyEquivalentRate(annualRatePercent: string): string;
/** FV de aporte mensal no fim de cada mês (prompt §16 Modo A). Taxa zero → aporte × n. */
export function calculateMonthlyContributionFutureValue(monthlyContribution: string, annualRatePercent: string, months: number): string; // 2 casas
/** FV de capital inicial (prompt §16 Modo B): inicial × (1 + taxaAnual)^anos. anos pode ser fracionário (meses/12). */
export function calculateCompoundFutureValue(initialAmount: string, annualRatePercent: string, years: string): string; // 2 casas
/** Taxa anual efetiva do CDI: taxaCdiAnual × percentualCdi/100 (prompt §17). */
export function cdiEffectiveAnnualRate(cdiAnnualRatePercent: string, cdiPercentage: string): string; // pontos %, 4 casas
```

- [ ] **Step 1: Testes que falham** — `investment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  calculateCompoundFutureValue, calculateMonthlyContributionFutureValue,
  cdiEffectiveAnnualRate, monthlyEquivalentRate,
} from "./investment";

describe("calculateMonthlyContributionFutureValue (caso 12: taxa zero)", () => {
  it("taxa zero → aporte × meses", () => {
    expect(calculateMonthlyContributionFutureValue("1000.00", "0", 24)).toBe("24000.00");
  });
});

describe("calculateMonthlyContributionFutureValue (caso 13: taxa positiva)", () => {
  it("aporte 1.000, 10,5% a.a., 12 meses (FV fim de mês)", () => {
    // taxa_mensal = 1.105^(1/12)-1 ≈ 0.00836484; FV = 1000 × ((1+i)^12 - 1)/i = 12567.09
    expect(calculateMonthlyContributionFutureValue("1000.00", "10.5", 12)).toBe("12567.09");
  });
});

describe("calculateCompoundFutureValue (caso 11: CDI juros compostos)", () => {
  it("10.000 a 10,5% a.a. por 2 anos", () => {
    // 10000 × 1.105^2 = 12210.25
    expect(calculateCompoundFutureValue("10000.00", "10.5", "2")).toBe("12210.25");
  });
  it("taxa zero mantém o capital", () => {
    expect(calculateCompoundFutureValue("10000.00", "0", "5")).toBe("10000.00");
  });
});

describe("cdiEffectiveAnnualRate (prompt §17)", () => {
  it("110% do CDI de 10,5% = 11,55%", () => {
    expect(cdiEffectiveAnnualRate("10.5", "110")).toBe("11.5500");
  });
});
```

(Confirmar valores com decimal.js; ajustar apenas o esperado se a fórmula correta produzir outra última casa, documentando.)

- [ ] **Step 2: FAIL → Step 3: Implementar** `investment.ts`:

```ts
import Decimal from "decimal.js";

function rateFraction(annualRatePercent: string): Decimal {
  return new Decimal(annualRatePercent).div(100);
}

export function monthlyEquivalentRate(annualRatePercent: string): string {
  const annual = new Decimal(1).plus(rateFraction(annualRatePercent));
  return annual.pow(new Decimal(1).div(12)).minus(1).toFixed(8);
}

export function calculateMonthlyContributionFutureValue(monthlyContribution: string, annualRatePercent: string, months: number): string {
  const contribution = new Decimal(monthlyContribution);
  const i = new Decimal(monthlyEquivalentRate(annualRatePercent));
  if (i.isZero()) return contribution.times(months).toFixed(2, Decimal.ROUND_HALF_UP);
  const factor = i.plus(1).pow(months).minus(1).div(i);
  return contribution.times(factor).toFixed(2, Decimal.ROUND_HALF_UP);
}

export function calculateCompoundFutureValue(initialAmount: string, annualRatePercent: string, years: string): string {
  const factor = new Decimal(1).plus(rateFraction(annualRatePercent)).pow(new Decimal(years));
  return new Decimal(initialAmount).times(factor).toFixed(2, Decimal.ROUND_HALF_UP);
}

export function cdiEffectiveAnnualRate(cdiAnnualRatePercent: string, cdiPercentage: string): string {
  return new Decimal(cdiAnnualRatePercent).times(new Decimal(cdiPercentage).div(100)).toFixed(4);
}
```

- [ ] **Step 4: PASS → Step 5: Commit** — `feat: valor futuro de investimentos (aporte mensal, capital inicial, CDI efetivo)`

---

### Task 4: Comparação consórcio × investimentos

**Files:**
- Create: `src/domain/financial-calculations/comparison.ts`, `src/domain/financial-calculations/comparison.test.ts`, `src/domain/financial-calculations/index.ts` (barrel re-exportando tudo)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:

```ts
export type ComparisonMode = "monthly_contribution" | "initial_capital";
export type ComparisonInput = {
  mode: ComparisonMode;
  monthlyInstallment: string;   // parcela base (aporte no Modo A)
  creditAmount: string;         // carta (capital no Modo B)
  months: number;
  investmentAnnualRatePercent: string;  // taxa do investimento comparado (CDI/IPCA/poupança/custom)
  consortiumAnnualRatePercent: string;  // índice contratual do consórcio (IGP-M/IPCA)
};
export type ComparisonResult = {
  mode: ComparisonMode;
  totalContributed: string;     // Modo A: aporte×meses; Modo B: capital inicial
  investmentGross: string;      // saldo bruto do investimento
  investmentEarnings: string;   // rendimento = bruto − aportado
  correctedCredit: string;      // carta corrigida pelo índice contratual no período
  differenceVsCredit: string;   // investmentGross − correctedCredit
  yearly: { year: number; invested: string; investmentBalance: string; correctedCredit: string }[];
};
export function compareConsortiumAndInvestments(input: ComparisonInput): ComparisonResult;
```

- [ ] **Step 1: Testes que falham** — `comparison.test.ts`: Modo A (aporte = parcela) e Modo B (capital = carta), verificando totalContributed, investmentGross (bate com as funções da Task 3), correctedCredit (bate com Task 1) e differenceVsCredit; série anual com pontos coerentes; caso taxa zero.

- [ ] **Step 2: FAIL → Step 3: Implementar** `comparison.ts` (compõe Tasks 1–3; Modo A usa `calculateMonthlyContributionFutureValue` e totalContributed = parcela×meses; Modo B usa `calculateCompoundFutureValue` com years = months/12 e totalContributed = capital; correctedCredit = `calculateCorrectedCredit(creditAmount, consortiumAnnualRatePercent, floor(months/12))`; série anual iterando anos). Criar `index.ts` barrel exportando correction + schedule + investment + comparison.

- [ ] **Step 4: PASS → Step 5: Commit** — `feat: comparação consórcio × investimentos (modos aporte e capital) + barrel do domínio financeiro`

---

### Task 5: Cenários, premissas e repository de índices

**Files:**
- Create: `src/domain/financial-calculations/assumptions.ts`, `src/domain/financial-calculations/assumptions.test.ts`, `src/repositories/indexes.ts`
- Modify: `src/repositories/settings.ts` (adicionar leitura de `projected_annual_rates`)

**Interfaces:**
- Produces:

```ts
// domain/assumptions.ts — puro
export type Scenario = "conservative" | "base" | "aggressive" | "custom";
export type ProjectedRates = { igpm: string; ipca: string; cdi: string; savings: string }; // pontos %
export type SimulationAssumptions = {
  scenario: Scenario;
  indexCode: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
  annualRatePercent: string;
  rateOrigin: string;      // "Taxa projetada configurada pelo administrador"
  rateUpdatedAt: string;   // ISO
  rateType: "projected" | "historical" | "manual";
  adjustmentFrequencyMonths: number;
};
/** Deriva a taxa do cenário a partir da taxa base do índice (conservador = −fator, agressivo = +fator, custom = override). */
export function resolveScenarioRate(baseRatePercent: string, scenario: Scenario, customRatePercent?: string): string;

// repositories/indexes.ts
export type FinancialIndex = { indexCode: string; annualRatePercent: string; source: string; updatedAt: string; projected: boolean };
export async function getLatestIndexes(): Promise<Record<string, FinancialIndex>>; // por index_code, mais recente
```

Regra de cenário (documentar): conservador = base × 0.7; base = base; agressivo = base × 1.3; custom = valor informado (só usuário autorizado — validação de papel fica na action, não no domínio). Todos com 4 casas.

- [ ] **Step 1: Testes do domínio** — `assumptions.test.ts`: resolveScenarioRate para os 4 cenários (base "6.5" → conservador "4.5500", base "6.5000", agressivo "8.4500", custom "10" → "10.0000"); pura, sem I/O.
- [ ] **Step 2: FAIL → Step 3: Implementar** domínio + `indexes.ts` (lê `financial_indexes`, pega o registro mais recente por `index_code`, normaliza rate para pontos %) + extensão de `settings.ts`.
- [ ] **Step 4: PASS + lint/typecheck** → **Step 5: Commit** — `feat: cenários de simulação e repository de índices financeiros`

---

### Task 6: Repository e service de simulações (snapshot imutável)

**Files:**
- Create: `src/repositories/simulations.ts`, `src/features/simulations/schema.ts`, `src/features/simulations/actions.ts`
- Create: `src/repositories/simulations.test.ts` (teste de imutabilidade sem banco — testar a função pura de montagem do snapshot)

**Interfaces:**
- Consumes: domínio (Tasks 1–5), `getClient` (F3), `getProduct` (F2), `getCurrentProfile`, `logAudit`.
- Produces:

```ts
// função PURA testável — monta o snapshot a partir de produto+premissas+seleção
export type SimulationSnapshotInput = {
  product: { id: string; productName: string; creditAmount: string; termMonths: number; regularInstallmentAmount: string; first12InstallmentAmount: string | null; totalAdministrationFeePercent: string; correctionIndex: string };
  assumptions: SimulationAssumptions;
  selectedMonth: number;
};
export type SimulationComputed = {
  selectedYear: number;
  baseCreditAmount: string; projectedCreditAmount: string;
  baseInstallmentAmount: string; projectedInstallmentAmount: string;
  projectedTotalPaid: string;
};
export function computeSimulation(input: SimulationSnapshotInput): SimulationComputed;

// repository (I/O)
export type SavedSimulation = { id: string; clientId: string; productSnapshot: unknown; assumptionsSnapshot: unknown; selectedYear: number | null; createdAt: string; /* ...campos computados */ };
export async function saveSimulation(params: { clientId: string; productId: string; input: SimulationSnapshotInput; monthlyAvailableAmount: string; monthlyIncome: string | null }): Promise<string>;
export async function listSimulationsByClient(clientId: string): Promise<SavedSimulation[]>;
export async function getSimulation(id: string): Promise<SavedSimulation | null>;
```

- [ ] **Step 1: Teste de imutabilidade (caso 19 e 20)** — `simulations.test.ts`:
  - `computeSimulation` é pura e determinística;
  - **caso 20**: dado um `product_snapshot` gravado, recomputar a simulação a partir do SNAPSHOT (não do produto atual) produz o mesmo resultado mesmo que os valores "atuais" do produto sejam diferentes — simular passando dois produtos distintos e provando que o snapshot preserva o original;
  - **caso 19**: `saveSimulation` monta `product_snapshot` com os valores do produto no momento (testar a função de montagem pura, sem tocar banco).

- [ ] **Step 2: FAIL → Step 3: Implementar** `computeSimulation` puro (usa Tasks 1–2: projectedCredit = calculateCorrectedCredit no ano do selectedMonth; projectedInstallment = correctedInstallmentForMonth; projectedTotalPaid = calculateTotalProjectedPayments até selectedMonth) + repository gravando snapshots JSON + schema Zod + action `saveSimulationAction` (valida, exige sessão, audita `simulation.create`).

- [ ] **Step 4: PASS + lint/typecheck** → **Step 5: Commit** — `feat: simulações com snapshot imutável e cálculo determinístico`

---

### Task 7: Painel de simulação — sliders, premissas, cenários

**Files:**
- Create: `src/features/simulations/simulation-panel.tsx`, `src/features/simulations/assumptions-block.tsx`, `src/features/simulations/correction-slider.tsx`
- Modify: `src/features/atendimento/result-cards.tsx` (botão "Simular" abre o painel — agora a Fase 4 habilita esse botão)
- Add: `pnpm dlx shadcn@latest add slider`; `pnpm add recharts`

**Interfaces:**
- Consumes: domínio financeiro (client-side!), `saveSimulationAction` (Task 6), taxas/índices carregados no servidor e passados como props.
- Produces: painel lateral (Dialog/Sheet) aberto a partir de um card do atendimento. Recebe o produto + premissas (taxas reais do servidor). Conteúdo:
  1. **Slider de tempo** 0→termMonths (passo mensal, exibe "X anos de Y"); ao mover, recalcula NO CLIENTE (funções puras): carta corrigida, parcela no período, total pago até o mês, total do plano, correção acumulada, nominal × corrigido. Gráfico anual (Recharts LineChart de `buildYearlySeries`).
  2. **Bloco Premissas** (`assumptions-block.tsx`): índice, taxa anual, origem, data de atualização, frequência de reajuste, tipo (projetada/histórica/manual), aviso "Estimativa — não é garantia de resultado".
  3. **Cenários**: botões Conservador/Base/Agressivo/Personalizado; Personalizado abre input de taxa **somente para admin/manager** (prop `canEditRate`); troca de cenário recalcula tudo no cliente via `resolveScenarioRate`.
  4. **Salvar simulação**: botão chama `saveSimulationAction` com o mês selecionado e as premissas correntes; feedback de sucesso.

- [ ] **Step 1: Implementar** slider + painel + bloco de premissas (todo cálculo via funções puras do domínio; ZERO fórmula no componente).
- [ ] **Step 2: Habilitar botão "Simular"** nos cards do atendimento (passar o produto selecionado ao painel).
- [ ] **Step 3: Verificação manual** (método task-8-report / dev server): abrir atendimento (disponível 1500), clicar Simular no plano recomendado, mover slider e ver valores mudarem; trocar cenário; salvar → conferir linha em `simulations` com snapshot via psql; consultor não vê input de taxa custom.
- [ ] **Step 4: lint/typecheck/test verdes** → **Step 5: Commit** — `feat: painel de simulação com slider de correção, cenários e premissas`

---

### Task 8: Componente CdiCompoundSlider + comparação com investimentos

**Files:**
- Create: `src/features/simulations/cdi-compound-slider.tsx`, `src/features/simulations/investment-comparison.tsx`
- Modify: `src/features/simulations/simulation-panel.tsx` (aba/section "Comparar com investimentos")

**Interfaces:**
- Consumes: `compareConsortiumAndInvestments`, `calculateMonthlyContributionFutureValue`, `calculateCompoundFutureValue`, `cdiEffectiveAnnualRate` (client-side); taxa CDI do servidor.
- Produces:
  - **`CdiCompoundSlider`** (prompt §17): slider de anos; taxa CDI anual; seletor % do CDI (80/90/100/110/120/custom); aporte mensal; valor inicial opcional; total aportado; rendimento; montante; gráfico anual; comparação com a carta corrigida. Rótulo "estimativa bruta". Opção de descontar IR/taxa adm (checkbox — quando ligado, aplica desconto simples informado; padrão desligado/bruto).
  - **`investment-comparison.tsx`**: seletor de índice comparado (CDI/IPCA/poupança/custom), modo A (aporte = parcela, padrão) / modo B (capital = carta); exibe total aportado, rendimentos, saldo bruto, saldo líquido (só com params tributários válidos), taxa, período, diferença vs carta corrigida; gráfico de evolução (Recharts) das duas curvas; texto fixo de ressalva ("consórcio e investimento têm objetivos, riscos, liquidez e características diferentes").

- [ ] **Step 1: Implementar** os dois componentes (cálculo só via domínio).
- [ ] **Step 2: Integrar** no painel de simulação como seção "Comparar com investimentos".
- [ ] **Step 3: Verificação manual**: mover slider do CDI e ver montante composto crescer; trocar % do CDI; alternar Modo A/B; conferir gráfico com duas curvas.
- [ ] **Step 4: lint/typecheck/test verdes** → **Step 5: Commit** — `feat: CdiCompoundSlider e comparação consórcio × investimentos com gráfico`

---

### Task 9: Histórico de simulações do cliente + resumo imprimível

**Files:**
- Modify: `src/app/(app)/clientes/page.tsx` ou criar `src/app/(app)/clientes/[id]/page.tsx` (página individual — versão mínima com histórico de simulações; CRM completo é Fase 5)
- Create: `src/features/simulations/simulations-history.tsx`, `src/app/(app)/simulacoes/[id]/resumo/page.tsx` (página imprimível)

**Interfaces:**
- Consumes: `listSimulationsByClient`, `getSimulation` (Task 6), formatadores.
- Produces:
  - Página individual do cliente (`/clientes/[id]`) mínima: dados + resumo financeiro + **histórico de simulações** (lista com produto, carta projetada, mês/ano selecionado, data) — cada item abre o resumo.
  - **Resumo imprimível** (`/simulacoes/[id]/resumo`, prompt §23): página print-friendly (CSS `@media print`, sem lib de PDF) com cliente, consultor, data, produto, carta, prazo, parcelas, taxa adm, índice, projeção selecionada, premissas usadas, comparação com CDI, avisos legais, contatos da empresa. Botão "Imprimir" (window.print). Tudo lido do SNAPSHOT da simulação (imutável), não do produto atual.

- [ ] **Step 1: Implementar** página individual mínima + histórico + página de resumo imprimível.
- [ ] **Step 2: Verificação manual**: salvar uma simulação, abrir a página do cliente, ver no histórico, abrir resumo e conferir que reflete o snapshot; testar impressão (layout print).
- [ ] **Step 3: lint/typecheck/test verdes** → **Step 4: Commit** — `feat: histórico de simulações do cliente e resumo imprimível`

---

### Task 10: Gate da Fase 4 + push

**Files:**
- Modify: `PLANS.md`, `README.md`, `docs/CALCULATIONS.md` (atualizar com as fórmulas implementadas e exemplos numéricos)

- [ ] **Step 1: Gate** — `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes.
- [ ] **Step 2: Mapear no relatório os testes obrigatórios do prompt cobertos nesta fase**: casos 8 (IGP-M), 9 (IPCA), 10 (taxa zero), 11 (CDI composto), 12 (aporte taxa zero), 13 (aporte taxa positiva), 14 (limite pelo prazo), 19 (snapshot), 20 (produto editado não altera simulação) — citar arquivo e nome de cada teste.
- [ ] **Step 3: Atualizar** `docs/CALCULATIONS.md` (fórmulas §14/§16/§17 com exemplos reais), PLANS.md (Fase 4 concluída, entregas), README (seção do simulador) → commit docs.
- [ ] **Step 4: `git push`**.

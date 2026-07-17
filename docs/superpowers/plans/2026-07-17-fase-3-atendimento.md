# Fase 3 — Clientes e Atendimento: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela "Novo atendimento" funcionando fim a fim: consultor informa nome + renda + valor disponível e recebe resumo (maior carta pagável, elegíveis, folga...) e cards ranqueados com selos de compatibilidade — motor de elegibilidade/ranking em domínio puro, validado pelo oráculo dos 4 clientes da planilha.

**Architecture:** Regras 100% puras em `src/domain/eligibility` e `src/domain/recommendation` (decimal.js, zero React/Supabase). O service de atendimento roda NO SERVIDOR: busca produtos ativos + settings, aplica domínio e devolve resultado pronto. Clientes têm repository + actions Zod; busca incremental via server action.

**Tech Stack:** decimal.js, Zod, shadcn/ui. Sem dependências novas.

## Global Constraints (valem para TODAS as tasks)

- TypeScript `strict: true`; lint limpo; pnpm. Diretório: `/Users/kaiobp/Documents/Soren-Consorcio-dashboard` (git, branch `main`).
- Regras financeiras SÓ em `src/domain` (funções puras, decimal.js); componentes React não calculam regra.
- Dinheiro trafega como string canônica "1234.56"; percentuais em pontos ("26.800"). Repositories normalizam NUMERIC vindo do PostgREST com decimal.js (padrão da Fase 2).
- `monthly_income` ≠ `monthly_available_amount` — nunca tratar como sinônimos. Elegibilidade usa SEMPRE o valor disponível.
- Regra de elegibilidade configurável (`system_settings.eligibility_rule.basis`: `"regular" | "first" | "max"`), default `"regular"` (regra da planilha); a regra em uso é exibida na tela. Parcela inicial acima do orçamento NUNCA é escondida (selo "Compatível com atenção").
- Ranking determinístico e explicável — sem IA opaca; cada card mostra por que foi pontuado.
- UI neutra shadcn, pt-BR, `formatCurrency`/`formatPercent` de `src/lib/format.ts`. shadcn usa `@base-ui/react` (prop `render`).
- Server Actions validam com Zod; banco só via `src/repositories/`.
- Supabase local API 54331 (`.env.local`); usuários demo admin@/ana@demo.soren.com.br senha demo12345; banco com 63 produtos property + 8 vehicle demo.
- Commits pt-BR convencional terminando com: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Oráculo (docs/ANALISE_PLANILHA.md): João Silva 1.500→240.000/23 · Maria Souza 3.200→580.000/56 · Carlos Pereira 800→140.000/6 · JANDIRINHA 4.550→600.000/63; JANDIRINHA menor parcela 644,00 e maior parcela compatível 3.804,00.
- Fase 3 NÃO cria botões "Simular" (Fase 4) nem "Criar oportunidade" (Fase 5) — não deixamos botões sem função.

---

### Task 1: Domínio de elegibilidade (classificação, folga, comprometimento)

**Files:**
- Create: `src/domain/eligibility/index.ts`, `src/domain/eligibility/eligibility.test.ts`

**Interfaces:**
- Produces:

```ts
export type EligibilityBasis = "regular" | "first" | "max";
export type Classification = "compatible" | "attention" | "incompatible";

export type EligibilityProduct = {
  id: string;
  productName: string;
  productCode: string;
  administratorName: string;
  category: "property" | "vehicle" | "other";
  creditAmount: string;               // "600000.00"
  termMonths: number;
  totalAdministrationFeePercent: string; // "26.800"
  first12InstallmentAmount: string | null;
  regularInstallmentAmount: string;
  correctionIndex: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
};

export type ClassifiedProduct = {
  product: EligibilityProduct;
  classification: Classification;
  monthlySlack: string;               // available − parcela da base, 2 casas (pode ser negativa)
  incomeCommitmentPercent: string | null; // parcela/renda ×100, 2 casas; null se renda ausente/zero
};

export function basisInstallment(p: EligibilityProduct, basis: EligibilityBasis): string;
export function classifyProduct(p: EligibilityProduct, availableAmount: string): Classification;
export function isEligible(p: EligibilityProduct, availableAmount: string, basis: EligibilityBasis): boolean;
export function calculateMonthlySlack(availableAmount: string, installment: string): string;
export function calculateIncomeCommitment(installment: string, monthlyIncome: string | null): string | null;
export function getEligibleProducts(
  products: EligibilityProduct[], availableAmount: string,
  basis: EligibilityBasis, monthlyIncome: string | null,
): ClassifiedProduct[]; // apenas elegíveis segundo basis; classification sempre pelas regras fixas do prompt
```

Semântica fixa (prompt §10):
- `classifyProduct`: `compatible` se regular ≤ disponível E (first12 ausente OU first12 ≤ disponível); `attention` se regular ≤ disponível E first12 > disponível; `incompatible` se regular > disponível. **Comparações inclusivas** (parcela igual ao disponível é compatível).
- `basisInstallment`: `regular` → regular; `first` → first12 (fallback regular se null); `max` → maior das duas.
- `isEligible`: `basisInstallment(p, basis) ≤ available`.
- `monthlySlack` do produto elegível = disponível − `basisInstallment` (2 casas).

- [ ] **Step 1: Teste que falha** — `src/domain/eligibility/eligibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  calculateIncomeCommitment, calculateMonthlySlack, classifyProduct,
  getEligibleProducts, isEligible, type EligibilityProduct,
} from "./index";

function makeProduct(over: Partial<EligibilityProduct> = {}): EligibilityProduct {
  return {
    id: "p1", productName: "Imóvel IE200 – 200m", productCode: "IE200",
    administratorName: "Não informada (planilha)", category: "property",
    creditAmount: "200000.00", termMonths: 200,
    totalAdministrationFeePercent: "24.800",
    first12InstallmentAmount: "1468.00", regularInstallmentAmount: "1268.00",
    correctionIndex: "IGPM", ...over,
  };
}

describe("classifyProduct (prompt §10)", () => {
  it("parcela exatamente igual ao disponível é compatível (inclusivo)", () => {
    const p = makeProduct({ regularInstallmentAmount: "1500.00", first12InstallmentAmount: "1500.00" });
    expect(classifyProduct(p, "1500.00")).toBe("compatible");
  });
  it("parcela acima do disponível é incompatível", () => {
    const p = makeProduct({ regularInstallmentAmount: "1500.01" });
    expect(classifyProduct(p, "1500.00")).toBe("incompatible");
  });
  it("recorrente cabe mas 1ª–12ª estoura → atenção (nunca esconder)", () => {
    const p = makeProduct({ regularInstallmentAmount: "1400.00", first12InstallmentAmount: "1600.00" });
    expect(classifyProduct(p, "1500.00")).toBe("attention");
  });
  it("sem first12 cadastrada, compatível se recorrente cabe", () => {
    const p = makeProduct({ first12InstallmentAmount: null, regularInstallmentAmount: "1400.00" });
    expect(classifyProduct(p, "1500.00")).toBe("compatible");
  });
});

describe("isEligible por basis", () => {
  const p = makeProduct({ regularInstallmentAmount: "1400.00", first12InstallmentAmount: "1600.00" });
  it("basis regular: só a recorrente importa", () => {
    expect(isEligible(p, "1500.00", "regular")).toBe(true);
  });
  it("basis first: a 1ª–12ª importa", () => {
    expect(isEligible(p, "1500.00", "first")).toBe(false);
  });
  it("basis max: maior das duas importa", () => {
    expect(isEligible(p, "1500.00", "max")).toBe(false);
    expect(isEligible(p, "1600.00", "max")).toBe(true);
  });
});

describe("folga e comprometimento", () => {
  it("folga mensal com precisão decimal", () => {
    expect(calculateMonthlySlack("1500.00", "1458.20")).toBe("41.80");
    expect(calculateMonthlySlack("1500.00", "1600.00")).toBe("-100.00");
  });
  it("comprometimento de renda em pontos percentuais, 2 casas", () => {
    expect(calculateIncomeCommitment("1268.00", "5000.00")).toBe("25.36");
    expect(calculateIncomeCommitment("1268.00", null)).toBeNull();
    expect(calculateIncomeCommitment("1268.00", "0.00")).toBeNull();
  });
});

describe("getEligibleProducts", () => {
  it("cliente sem produtos elegíveis retorna lista vazia", () => {
    const products = [makeProduct({ regularInstallmentAmount: "900.00" })];
    expect(getEligibleProducts(products, "800.00", "regular", null)).toHaveLength(0);
  });
  it("inclui attention quando basis=regular e ordena nada (ordem de entrada)", () => {
    const attention = makeProduct({ id: "a", regularInstallmentAmount: "1400.00", first12InstallmentAmount: "1600.00" });
    const result = getEligibleProducts([attention], "1500.00", "regular", "3000.00");
    expect(result).toHaveLength(1);
    expect(result[0].classification).toBe("attention");
    expect(result[0].monthlySlack).toBe("100.00");
    expect(result[0].incomeCommitmentPercent).toBe("46.67");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm test src/domain` → FAIL.

- [ ] **Step 3: Implementar** — `src/domain/eligibility/index.ts`:

```ts
import Decimal from "decimal.js";

export type EligibilityBasis = "regular" | "first" | "max";
export type Classification = "compatible" | "attention" | "incompatible";

export type EligibilityProduct = {
  id: string;
  productName: string;
  productCode: string;
  administratorName: string;
  category: "property" | "vehicle" | "other";
  creditAmount: string;
  termMonths: number;
  totalAdministrationFeePercent: string;
  first12InstallmentAmount: string | null;
  regularInstallmentAmount: string;
  correctionIndex: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
};

export type ClassifiedProduct = {
  product: EligibilityProduct;
  classification: Classification;
  monthlySlack: string;
  incomeCommitmentPercent: string | null;
};

export function basisInstallment(p: EligibilityProduct, basis: EligibilityBasis): string {
  const regular = new Decimal(p.regularInstallmentAmount);
  const first = p.first12InstallmentAmount ? new Decimal(p.first12InstallmentAmount) : null;
  if (basis === "first") return (first ?? regular).toFixed(2);
  if (basis === "max") return (first && first.gt(regular) ? first : regular).toFixed(2);
  return regular.toFixed(2);
}

export function classifyProduct(p: EligibilityProduct, availableAmount: string): Classification {
  const available = new Decimal(availableAmount);
  const regular = new Decimal(p.regularInstallmentAmount);
  if (regular.gt(available)) return "incompatible";
  const first = p.first12InstallmentAmount ? new Decimal(p.first12InstallmentAmount) : null;
  if (first && first.gt(available)) return "attention";
  return "compatible";
}

export function isEligible(p: EligibilityProduct, availableAmount: string, basis: EligibilityBasis): boolean {
  return new Decimal(basisInstallment(p, basis)).lte(new Decimal(availableAmount));
}

export function calculateMonthlySlack(availableAmount: string, installment: string): string {
  return new Decimal(availableAmount).minus(installment).toFixed(2);
}

export function calculateIncomeCommitment(installment: string, monthlyIncome: string | null): string | null {
  if (!monthlyIncome) return null;
  const income = new Decimal(monthlyIncome);
  if (income.lte(0)) return null;
  return new Decimal(installment).div(income).times(100).toFixed(2);
}

export function getEligibleProducts(
  products: EligibilityProduct[],
  availableAmount: string,
  basis: EligibilityBasis,
  monthlyIncome: string | null,
): ClassifiedProduct[] {
  return products
    .filter((p) => isEligible(p, availableAmount, basis))
    .map((p) => {
      const installment = basisInstallment(p, basis);
      return {
        product: p,
        classification: classifyProduct(p, availableAmount),
        monthlySlack: calculateMonthlySlack(availableAmount, installment),
        incomeCommitmentPercent: calculateIncomeCommitment(installment, monthlyIncome),
      };
    });
}
```

- [ ] **Step 4: Rodar** — `pnpm test src/domain` → PASS (12 novos).

- [ ] **Step 5: Commit**

```bash
git add src/domain/eligibility/
git commit -m "feat: domínio de elegibilidade — classificação, basis configurável, folga e comprometimento

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Resumo do atendimento + testes-oráculo dos 4 clientes

**Files:**
- Create: `src/domain/eligibility/summary.ts`, `src/domain/eligibility/summary.test.ts`, `src/domain/eligibility/oracle.test.ts`

**Interfaces:**
- Consumes: Task 1; `parseConsorcioXlsx` (F2) apenas NOS TESTES (oráculo).
- Produces:

```ts
export type EligibilitySummary = {
  eligibleCount: number;
  maxPayableCredit: string | null;      // maior carta entre elegíveis
  minInstallment: string | null;        // menor parcela (basis) entre elegíveis
  maxCompatibleInstallment: string | null; // maior parcela (basis) entre elegíveis
  bestSlack: string | null;             // maior folga
  maxCommitmentPercent: string | null;  // comprometimento da MAIOR parcela elegível vs renda
};
export function summarizeEligibility(classified: ClassifiedProduct[], basis: EligibilityBasis, monthlyIncome: string | null): EligibilitySummary;
```

- [ ] **Step 1: Testes que falham**

`src/domain/eligibility/summary.test.ts` (unitário com 2–3 produtos sintéticos verificando cada campo, incluindo lista vazia → tudo null/0).

`src/domain/eligibility/oracle.test.ts` (ORÁCULO REAL — copiar exatamente):

```ts
import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { parseConsorcioXlsx, type ParsedProduct } from "@/lib/xlsx/parse-consorcio";
import { getEligibleProducts, type EligibilityProduct } from "./index";
import { summarizeEligibility } from "./summary";

const XLSX_PATH = path.resolve(__dirname, "../../../references/consorcio.xlsx");
let products: EligibilityProduct[] = [];

function toEligibility(p: ParsedProduct, i: number): EligibilityProduct {
  return {
    id: `x${i}`, productName: p.productName, productCode: p.productCode,
    administratorName: "Não informada (planilha)", category: "property",
    creditAmount: p.creditAmount, termMonths: p.termMonths,
    totalAdministrationFeePercent: p.totalAdministrationFeePercent,
    first12InstallmentAmount: p.first12InstallmentAmount,
    regularInstallmentAmount: p.regularInstallmentAmount,
    correctionIndex: "IGPM",
  };
}

beforeAll(async () => {
  const parsed = await parseConsorcioXlsx(XLSX_PATH);
  products = parsed.products.map(toEligibility);
});

// Oráculo: valores publicados na planilha (abas Clientes/Dashboard) — regra da planilha = basis "regular"
const ORACLE = [
  { name: "João Silva", available: "1500.00", maxCredit: "240000.00", count: 23 },
  { name: "Maria Souza", available: "3200.00", maxCredit: "580000.00", count: 56 },
  { name: "Carlos Pereira", available: "800.00", maxCredit: "140000.00", count: 6 },
  { name: "JANDIRINHA", available: "4550.00", maxCredit: "600000.00", count: 63 },
];

describe("oráculo da planilha (basis regular)", () => {
  for (const c of ORACLE) {
    it(`${c.name}: ${c.count} elegíveis, maior carta ${c.maxCredit}`, () => {
      const eligible = getEligibleProducts(products, c.available, "regular", null);
      const summary = summarizeEligibility(eligible, "regular", null);
      expect(summary.eligibleCount).toBe(c.count);
      expect(summary.maxPayableCredit).toBe(c.maxCredit);
    });
  }

  it("JANDIRINHA: menor parcela 644.00 e maior parcela compatível 3804.00 (aba Dashboard)", () => {
    const eligible = getEligibleProducts(products, "4550.00", "regular", null);
    const summary = summarizeEligibility(eligible, "regular", null);
    expect(summary.minInstallment).toBe("644.00");
    expect(summary.maxCompatibleInstallment).toBe("3804.00");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL (summary inexistente).

- [ ] **Step 3: Implementar** — `src/domain/eligibility/summary.ts`:

```ts
import Decimal from "decimal.js";
import {
  basisInstallment, calculateIncomeCommitment,
  type ClassifiedProduct, type EligibilityBasis,
} from "./index";

export type EligibilitySummary = {
  eligibleCount: number;
  maxPayableCredit: string | null;
  minInstallment: string | null;
  maxCompatibleInstallment: string | null;
  bestSlack: string | null;
  maxCommitmentPercent: string | null;
};

export function summarizeEligibility(
  classified: ClassifiedProduct[],
  basis: EligibilityBasis,
  monthlyIncome: string | null,
): EligibilitySummary {
  if (classified.length === 0) {
    return {
      eligibleCount: 0, maxPayableCredit: null, minInstallment: null,
      maxCompatibleInstallment: null, bestSlack: null, maxCommitmentPercent: null,
    };
  }
  let maxCredit = new Decimal(-1);
  let minInst: Decimal | null = null;
  let maxInst: Decimal | null = null;
  let bestSlack: Decimal | null = null;
  for (const c of classified) {
    const credit = new Decimal(c.product.creditAmount);
    if (credit.gt(maxCredit)) maxCredit = credit;
    const inst = new Decimal(basisInstallment(c.product, basis));
    if (!minInst || inst.lt(minInst)) minInst = inst;
    if (!maxInst || inst.gt(maxInst)) maxInst = inst;
    const slack = new Decimal(c.monthlySlack);
    if (!bestSlack || slack.gt(bestSlack)) bestSlack = slack;
  }
  return {
    eligibleCount: classified.length,
    maxPayableCredit: maxCredit.toFixed(2),
    minInstallment: minInst!.toFixed(2),
    maxCompatibleInstallment: maxInst!.toFixed(2),
    bestSlack: bestSlack!.toFixed(2),
    maxCommitmentPercent: calculateIncomeCommitment(maxInst!.toFixed(2), monthlyIncome),
  };
}
```

- [ ] **Step 4: Rodar** — `pnpm test src/domain` → PASS (oráculo 5/5 + summary).

- [ ] **Step 5: Commit**

```bash
git add src/domain/eligibility/
git commit -m "feat: resumo de elegibilidade validado pelo oráculo dos 4 clientes da planilha

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Domínio de ranking explicável

**Files:**
- Create: `src/domain/recommendation/index.ts`, `src/domain/recommendation/ranking.test.ts`

**Interfaces:**
- Consumes: `ClassifiedProduct`, `EligibilityBasis` (Task 1).
- Produces:

```ts
export type RankingPreferences = {
  desiredCategory: "property" | "vehicle" | "other" | "all";
  desiredTermMonths: number | null;
};
export type ScoreReason = { label: string; points: number }; // ex.: {label: "Totalmente compatível", points: 30}
export type RankedProduct = ClassifiedProduct & {
  score: number;          // 0–100, 1 casa decimal
  reasons: ScoreReason[];
};
export type RankingHighlights = {
  biggestCredit: string | null;     // product.id
  lowestInstallment: string | null;
  shortestTerm: string | null;
  lowestFee: string | null;
  bestBalance: string | null;       // maior (carta ÷ parcela basis)
};
export function rankConsortiumProducts(
  classified: ClassifiedProduct[], prefs: RankingPreferences, basis: EligibilityBasis,
): { ranked: RankedProduct[]; highlights: RankingHighlights };
```

Pontuação determinística (pesos somam 100; documentar em cada reason):
| Critério | Peso | Regra |
|---|---|---|
| Compatibilidade | 30 | compatible=30; attention=15 |
| Valor da carta | 25 | 25 × carta ÷ maiorCartaElegível |
| Folga mensal | 15 | 15 × folga ÷ maiorFolgaElegível (folga<0 → 0) |
| Categoria desejada | 10 | match ou prefs "all" = 10; senão 0 |
| Prazo desejado | 10 | sem preferência = 10 p/ todos; com preferência: 10 × max(0, 1 − |prazo−desejado|÷desejado) |
| Taxa administrativa | 10 | menorTaxa÷taxa × 10 |

Empate: maior carta → menor taxa → menor prazo → productCode asc (estável/determinístico).

- [ ] **Step 1: Testes que falham** — `ranking.test.ts` com produtos sintéticos:
  1. "ranking por maior carta" (prompt teste 5): dois produtos compatible com mesma folga/taxa/prazo → maior carta primeiro e score maior;
  2. attention perde para compatible de carta igual;
  3. categoria desejada pontua (vehicle pedido → produto vehicle na frente de property equivalente);
  4. reasons somam o score (soma dos points ≈ score, tolerância 0.1);
  5. highlights corretos (biggestCredit/lowestInstallment/shortestTerm/lowestFee/bestBalance) num conjunto de 3 produtos distintos;
  6. determinismo: mesma entrada 2× → mesma ordem.

Escrever os testes completos (construtor `makeClassified(...)` local ao teste com valores explícitos).

- [ ] **Step 2: FAIL** → **Step 3: Implementar** `src/domain/recommendation/index.ts` conforme a tabela acima (Decimal para razões carta/folga/taxa; score final `Number(x.toFixed(1))`; reasons com labels pt-BR: "Totalmente compatível" / "Compatível com atenção" / "Valor da carta" / "Folga mensal" / "Categoria desejada" / "Prazo próximo do desejado" / "Taxa administrativa baixa"). Highlights: percorrer elegíveis uma vez; bestBalance = maior `carta ÷ basisInstallment`.

- [ ] **Step 4: PASS** → **Step 5: Commit**

```bash
git add src/domain/recommendation/
git commit -m "feat: ranking determinístico e explicável com destaques

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Repository e actions de clientes

**Files:**
- Create: `src/repositories/clients.ts`, `src/features/clients/schema.ts`, `src/features/clients/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `getCurrentProfile`, `logAudit` (fases 1–2).
- Produces:

```ts
// repositories/clients.ts
export type Client = {
  id: string; name: string; email: string | null; phone: string | null;
  monthlyIncome: string | null; monthlyAvailableAmount: string | null;
  consultantId: string; status: string; createdAt: string;
};
export async function searchClients(term: string, limit?: number): Promise<Client[]>; // ilike sanitizado, RLS filtra por papel
export async function listClients(): Promise<Client[]>;
export async function getClient(id: string): Promise<Client | null>;
export async function insertClient(data: { name: string; email?: string | null; phone?: string | null; monthlyIncome?: string | null; monthlyAvailableAmount?: string | null }): Promise<string>;
export async function updateClientFinancials(id: string, monthlyIncome: string | null, monthlyAvailableAmount: string): Promise<void>;
// features/clients/actions.ts
export async function createClientAction(prev, formData): Promise<{ error?: string; clientId?: string }>;
export async function searchClientsAction(term: string): Promise<Client[]>; // p/ busca incremental
```

Regras: NUMERIC→string canônica no mapeamento (padrão F2); `insertClient` seta `organization_id` do perfil e `consultant_id = profile.id`; Zod `createClientSchema` (name min 3; email opcional válido; monthlyIncome/monthlyAvailableAmount strings decimais opcionais `^\d+(\.\d{1,2})?$`); auditoria `client.create`; sanitizar termo de busca (`replace(/[,()%]/g, " ")`).

- [ ] **Step 1: Implementar os 3 arquivos** (padrão idêntico a products da F2 — repository com tipo Row + mapeamento, schema Zod, actions com checagem de sessão; consultor pode criar cliente: RLS `clients_insert` já permite org members).
- [ ] **Step 2: `pnpm lint && pnpm typecheck && pnpm test`** verdes.
- [ ] **Step 3: Commit** — `feat: repository e actions de clientes com busca incremental`

---

### Task 5: Página /clientes (lista + cadastro)

**Files:**
- Modify: `src/app/(app)/clientes/page.tsx` (substituir placeholder)
- Create: `src/features/clients/clients-table.tsx`, `src/features/clients/client-form.tsx`

**Interfaces:**
- Consumes: `listClients`, `createClientAction` (Task 4), `formatCurrency`/`formatDate` (F1).
- Produces: rota `/clientes` com tabela (nome, contato, renda, disponível, consultor, data) + dialog "Novo cliente" (padrão do `product-form` da F2, inclusive fechamento por comparação de estado em render — NÃO usar setState em useEffect). CRM completo (filtros, timeline, página individual) fica para a Fase 5 — indicar isso num texto discreto.

- [ ] **Step 1: Implementar** (espelhar padrão da página /produtos da F2).
- [ ] **Step 2: Verificação manual** — método task-8-report: ana@ cria cliente e vê apenas os seus; admin vê todos (RLS staff).
- [ ] **Step 3: lint/typecheck/test verdes** → **Step 4: Commit** — `feat: página de clientes com cadastro e lista por papel`

---

### Task 6: Service de atendimento (servidor)

**Files:**
- Create: `src/services/atendimento.ts`, `src/repositories/settings.ts`

**Interfaces:**
- Consumes: domínio (Tasks 1–3), `listProducts` (F2 — filtrar `status=active`), settings.
- Produces:

```ts
// repositories/settings.ts
export type OrgSettings = {
  eligibilityBasis: "regular" | "first" | "max";  // default "regular"
  maxIncomeCommitmentPercent: number;              // default 30
};
export async function getOrgSettings(): Promise<OrgSettings>; // lê system_settings, aplica defaults

// services/atendimento.ts
export type AtendimentoInput = {
  monthlyAvailableAmount: string;
  monthlyIncome: string | null;
  desiredCategory: "property" | "vehicle" | "other" | "all";
  desiredTermMonths: number | null;
};
export type AtendimentoResult = {
  summary: EligibilitySummary;
  ranked: RankedProduct[];
  highlights: RankingHighlights;
  basis: EligibilityBasis;
  basisLabel: string;                  // "Parcela recorrente" | "Parcela inicial (1ª–12ª)" | "Maior parcela"
  riskAlert: string | null;            // comprometimento acima do teto configurado
  incomeCommitmentPercent: string | null; // disponível ÷ renda ×100 (do cliente, não do produto)
};
export async function runAtendimento(input: AtendimentoInput): Promise<AtendimentoResult>;
```

Regras: produtos ativos filtrados por categoria quando ≠ "all" (demo de veículo participa — é o único estoque vehicle); `riskAlert` quando `incomeCommitmentPercent > maxIncomeCommitmentPercent` (mensagem: "Comprometimento de X% da renda — acima do teto recomendado de Y%"); `incomeCommitmentPercent` = disponível÷renda (usa `calculateIncomeCommitment(available, income)`). Nenhum cálculo fora do domínio.

- [ ] **Step 1: Implementar settings repository** (ler `system_settings` keys `eligibility_rule` e `max_income_commitment_percent`, com defaults e parse defensivo).
- [ ] **Step 2: Implementar service** (mapear Product→EligibilityProduct é direto — mesmos campos).
- [ ] **Step 3: lint/typecheck/test verdes** → **Step 4: Commit** — `feat: service de atendimento com regra configurável e alerta de risco`

---

### Task 7: Tela "Novo atendimento"

**Files:**
- Modify: `src/app/(app)/atendimento/page.tsx`
- Create: `src/features/atendimento/atendimento-form.tsx`, `src/features/atendimento/summary-header.tsx`, `src/features/atendimento/result-cards.tsx`, `src/features/atendimento/actions.ts`

**Interfaces:**
- Consumes: `runAtendimento` (T6), `searchClientsAction`/`createClientAction` (T4), domínio via tipos.
- Produces: fluxo completo:

1. **Form** (client component): nome do cliente com busca incremental (debounce 300ms chamando `searchClientsAction`; dropdown para selecionar existente — preenche renda/disponível salvos — ou "Criar novo"); renda mensal (opcional); **valor disponível (obrigatório)**; categoria (Todas/Imóvel/Veículo); prazo desejado opcional (select 200/220/240/48/60/livre). Submit → server action `atender`.
2. **Server action** `src/features/atendimento/actions.ts`: Zod (`available` obrigatório decimal>0; income opcional; category enum; term opcional int>0; clientId opcional uuid; clientName min 2). Se `clientId` ausente → `insertClient` com os dados informados; se presente → `updateClientFinancials`. Chama `runAtendimento`, retorna `AtendimentoResult` + client info (serializável).
3. **Summary header**: nome, renda, disponível, comprometimento da renda, maior carta pagável, nº elegíveis, menor parcela, maior parcela compatível, melhor folga, badge da regra em uso (`basisLabel`), riskAlert em destaque quando presente.
4. **Cards**: grid responsivo; cada card = nome do plano, administradora, categoria, carta (destaque), prazo, parcela 1ª–12ª, parcela recorrente, taxa adm, índice, folga, comprometimento (se renda), selo (verde "Compatível" / amarelo "Atenção: 1ª–12ª acima do disponível" — cores semânticas do shadcn: `default`/`secondary`/`destructive` + classes `text-*` neutras, sem identidade visual), badge "Plano recomendado" no 1º, badges de destaque (maior carta/menor parcela/menor prazo/menor taxa/melhor equilíbrio) e um `<details>` "Por que este plano?" com as reasons e pontos. Filtro client-side simples: mostrar/ocultar "apenas totalmente compatíveis" + filtro por categoria (os demais filtros do prompt §12 chegam com o refinamento visual da fase final).
5. Estado vazio: "Nenhum plano cabe no valor informado" com o menor valor de parcela do catálogo como dica.

- [ ] **Step 1: Implementar actions + componentes + página.**
- [ ] **Step 2: Verificação manual (método task-8-report), casos**: (a) cliente novo "Teste F3" com disponível 1500 → 23 elegíveis, maior carta 240.000 (oráculo João Silva!); (b) disponível 800 → 6 elegíveis; (c) disponível 500 → estado vazio; (d) renda 2000 + disponível 1500 → riskAlert (75% > 30%); (e) categoria Veículo → só demos IPCA. Limpar clientes de teste ao final (delete via psql).
- [ ] **Step 3: lint/typecheck/test verdes** → **Step 4: Commit** — `feat: tela Novo atendimento com resumo, cards ranqueados e alerta de risco`

---

### Task 8: Gate da Fase 3 + push

**Files:**
- Modify: `PLANS.md`, `README.md`

- [ ] **Step 1: Gate** — `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes.
- [ ] **Step 2: Conferir cobertura dos testes obrigatórios do prompt** nesta fase: casos 1–7 (igual/acima/inicial estoura/sem elegíveis/ranking maior carta/folga/comprometimento) presentes nos arquivos de teste do domínio — listar no relatório onde cada um está.
- [ ] **Step 3: PLANS.md (Fase 3 concluída, entregas) + README (seção de uso da tela de atendimento)** → commit docs.
- [ ] **Step 4: `git push`**.

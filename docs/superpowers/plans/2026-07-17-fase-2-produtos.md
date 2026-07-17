# Fase 2 — Produtos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogo de produtos de consórcio funcionando com dados reais: importador XLSX idempotente (63 produtos da planilha), produtos demo de veículo, CRUD com auditoria e listagem com filtros — validado por testes-oráculo contra a planilha.

**Architecture:** Normalização e parsing em módulos puros (`src/lib/xlsx`, testáveis sem banco); script de importação usa service role e é idempotente por chave de dedup; UI acessa dados só via repositories + Server Actions com Zod; RLS já garante escrita staff-only (policy `products_write`).

**Tech Stack:** ExcelJS (leitura de .xlsx em Node — ativamente mantida; o pacote npm `xlsx` do SheetJS está desatualizado no registry), decimal.js, Zod, shadcn/ui.

## Global Constraints (valem para TODAS as tasks)

- TypeScript `strict: true`; lint limpo; pnpm. Diretório: `/Users/kaiobp/Documents/Soren-Consorcio-dashboard` (git, branch `main`).
- Dinheiro: `NUMERIC(14,2)` no banco; **nunca** float para persistir dinheiro; cálculos de domínio com `decimal.js`.
- Percentuais persistidos em **pontos percentuais** `NUMERIC(6,3)` (planilha traz fração: `0.268` → gravar `26.800`).
- Nenhuma taxa financeira hardcoded na aplicação (dados de produto importados são dados, não taxas de projeção).
- UI neutra shadcn/ui, pt-BR, formatação via `src/lib/format.ts` (`formatCurrency`, `formatPercent`).
- Supabase local: API `http://127.0.0.1:54331`, credenciais em `.env.local`. Rotas protegidas via `src/proxy.ts` (Next 16). shadcn usa `@base-ui/react` (prop `render`, não `asChild`).
- Server Actions sempre validam entrada com Zod; banco só via `src/repositories/`.
- Commits em português convencional terminando com: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Oráculo (docs/ANALISE_PLANILHA.md): 63 produtos; IE600-240m → parcela 3.220,00 / 1ª-12ª 3.820,00; IE580-240m → 3.112,67; taxas 24,8/25,8/26,8 pontos conforme prazo 200/220/240.

---

### Task 1: Normalização de valores (lib pura)

**Files:**
- Create: `src/lib/xlsx/normalize.ts`, `src/lib/xlsx/normalize.test.ts`

**Interfaces:**
- Produces: `fractionToPercentPoints(fraction: number): string` (0.268 → "26.800"); `toMoneyString(value: number): string` (3112.666666 → "3112.67", arredondamento half-up via decimal.js); ambos retornam **string** (formato aceito pelo Postgres NUMERIC, evita float na borda).

- [ ] **Step 1: Instalar decimal.js**

```bash
pnpm add decimal.js
```

- [ ] **Step 2: Teste que falha**

`src/lib/xlsx/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fractionToPercentPoints, toMoneyString } from "./normalize";

describe("fractionToPercentPoints", () => {
  it("converte fração da planilha para pontos percentuais com 3 casas", () => {
    expect(fractionToPercentPoints(0.268)).toBe("26.800");
    expect(fractionToPercentPoints(0.248)).toBe("24.800");
    expect(fractionToPercentPoints(0.02)).toBe("2.000");
  });
});

describe("toMoneyString", () => {
  it("arredonda a 2 casas half-up sem erro de float", () => {
    expect(toMoneyString(3112.666666)).toBe("3112.67");
    expect(toMoneyString(3220)).toBe("3220.00");
    expect(toMoneyString(1985.4499999999998)).toBe("1985.45");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `pnpm test` → FAIL (módulo inexistente).

- [ ] **Step 4: Implementar**

`src/lib/xlsx/normalize.ts`:

```ts
import Decimal from "decimal.js";

/** Fração (0.268) → pontos percentuais "26.800" (NUMERIC(6,3)). */
export function fractionToPercentPoints(fraction: number): string {
  return new Decimal(fraction).times(100).toFixed(3);
}

/** Número da planilha → string monetária "1234.56" (NUMERIC(14,2), half-up). */
export function toMoneyString(value: number): string {
  return new Decimal(value).toFixed(2, Decimal.ROUND_HALF_UP);
}
```

- [ ] **Step 5: Rodar testes** — `pnpm test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/xlsx/ package.json pnpm-lock.yaml
git commit -m "feat: normalização de valores monetários e percentuais com decimal.js

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Parser da planilha (ExcelJS) com teste-oráculo

**Files:**
- Create: `src/lib/xlsx/parse-consorcio.ts`, `src/lib/xlsx/parse-consorcio.test.ts`

**Interfaces:**
- Consumes: `fractionToPercentPoints`, `toMoneyString` (Task 1).
- Produces:

```ts
export type ParsedProduct = {
  productName: string;        // "Imóvel IE600 – 240m"
  productCode: string;        // "IE600"
  creditAmount: string;       // "600000.00"
  termMonths: number;         // 240
  totalAdministrationFeePercent: string; // "26.800"
  first12InstallmentAmount: string;      // "3820.00"
  regularInstallmentAmount: string;      // "3220.00"
};
export type ParseResult = {
  products: ParsedProduct[];
  invalidRows: { rowNumber: number; reason: string }[];
};
export async function parseConsorcioXlsx(filePath: string): Promise<ParseResult>;
```

- [ ] **Step 1: Instalar ExcelJS** — `pnpm add exceljs`

- [ ] **Step 2: Teste-oráculo que falha**

`src/lib/xlsx/parse-consorcio.test.ts` (usa a planilha REAL do repo):

```ts
import { describe, expect, it } from "vitest";
import path from "node:path";
import { parseConsorcioXlsx } from "./parse-consorcio";

const XLSX_PATH = path.resolve(__dirname, "../../../references/consorcio.xlsx");

describe("parseConsorcioXlsx (oráculo: planilha real)", () => {
  it("extrai exatamente 63 produtos válidos, sem linhas inválidas", async () => {
    const { products, invalidRows } = await parseConsorcioXlsx(XLSX_PATH);
    expect(products).toHaveLength(63);
    expect(invalidRows).toHaveLength(0);
  });

  it("reproduz os valores exatos do IE600-240m e IE580-240m", async () => {
    const { products } = await parseConsorcioXlsx(XLSX_PATH);
    const ie600 = products.find((p) => p.productName === "Imóvel IE600 – 240m");
    expect(ie600).toMatchObject({
      productCode: "IE600",
      creditAmount: "600000.00",
      termMonths: 240,
      totalAdministrationFeePercent: "26.800",
      first12InstallmentAmount: "3820.00",
      regularInstallmentAmount: "3220.00",
    });
    const ie580 = products.find((p) => p.productName === "Imóvel IE580 – 240m");
    expect(ie580?.regularInstallmentAmount).toBe("3112.67");
  });

  it("taxa correlata ao prazo em todos os produtos", async () => {
    const { products } = await parseConsorcioXlsx(XLSX_PATH);
    const expected: Record<number, string> = { 200: "24.800", 220: "25.800", 240: "26.800" };
    for (const p of products) {
      expect(p.totalAdministrationFeePercent).toBe(expected[p.termMonths]);
    }
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `pnpm test src/lib/xlsx` → FAIL.

- [ ] **Step 4: Implementar**

`src/lib/xlsx/parse-consorcio.ts`:

```ts
import ExcelJS from "exceljs";
import { fractionToPercentPoints, toMoneyString } from "./normalize";

export type ParsedProduct = {
  productName: string;
  productCode: string;
  creditAmount: string;
  termMonths: number;
  totalAdministrationFeePercent: string;
  first12InstallmentAmount: string;
  regularInstallmentAmount: string;
};

export type ParseResult = {
  products: ParsedProduct[];
  invalidRows: { rowNumber: number; reason: string }[];
};

const SHEET_NAME = "Consórcios";
// Cabeçalhos esperados (linha 1) — validados para detectar mudança de layout
const EXPECTED_HEADERS = [
  "Produto", "Código", "Valor da Carta (R$)", "Prazo (meses)",
  "Taxa Adm Total (%)", "Parcela 1ª a 12ª (R$)", "Parcela Mensal (R$)",
];

function cellNumber(v: ExcelJS.CellValue): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function cellText(v: ExcelJS.CellValue): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function parseConsorcioXlsx(filePath: string): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`Aba "${SHEET_NAME}" não encontrada em ${filePath}`);

  const headers = EXPECTED_HEADERS.map((_, i) => cellText(ws.getRow(1).getCell(i + 1).value));
  EXPECTED_HEADERS.forEach((expected, i) => {
    if (headers[i] !== expected) {
      throw new Error(`Cabeçalho inesperado na coluna ${i + 1}: "${headers[i]}" (esperado "${expected}")`);
    }
  });

  const products: ParsedProduct[] = [];
  const invalidRows: ParseResult["invalidRows"] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(1).value);
    if (!name) return; // linha vazia — fim dos dados
    const code = cellText(row.getCell(2).value);
    const credit = cellNumber(row.getCell(3).value);
    const term = cellNumber(row.getCell(4).value);
    const fee = cellNumber(row.getCell(5).value);
    const first12 = cellNumber(row.getCell(6).value);
    const regular = cellNumber(row.getCell(7).value);

    const missing = [
      !code && "Código", !credit && "Valor da Carta", !term && "Prazo",
      !fee && "Taxa Adm", !first12 && "Parcela 1ª a 12ª", !regular && "Parcela Mensal",
    ].filter(Boolean);
    if (missing.length > 0) {
      invalidRows.push({ rowNumber, reason: `Campos ausentes/inválidos: ${missing.join(", ")}` });
      return;
    }
    if (credit! <= 0 || term! <= 0 || regular! <= 0) {
      invalidRows.push({ rowNumber, reason: "Valores não positivos" });
      return;
    }

    products.push({
      productName: name,
      productCode: code!,
      creditAmount: toMoneyString(credit!),
      termMonths: term!,
      totalAdministrationFeePercent: fractionToPercentPoints(fee!),
      first12InstallmentAmount: toMoneyString(first12!),
      regularInstallmentAmount: toMoneyString(regular!),
    });
  });

  return { products, invalidRows };
}
```

- [ ] **Step 5: Rodar testes** — `pnpm test src/lib/xlsx` → PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add src/lib/xlsx/ package.json pnpm-lock.yaml
git commit -m "feat: parser da aba Consórcios com ExcelJS e testes-oráculo (63 produtos)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Plano de importação (lógica pura de dedup/idempotência)

**Files:**
- Create: `src/lib/xlsx/import-plan.ts`, `src/lib/xlsx/import-plan.test.ts`

**Interfaces:**
- Consumes: `ParsedProduct` (Task 2).
- Produces:

```ts
export type ExistingProduct = ParsedProduct & { id: string };
export type ImportPlan = {
  toInsert: ParsedProduct[];
  toUpdate: { id: string; data: ParsedProduct }[];
  unchanged: ParsedProduct[];
};
/** Chave de dedup: productCode + termMonths + creditAmount (categoria fixa 'property' na importação). */
export function dedupKey(p: Pick<ParsedProduct, "productCode" | "termMonths" | "creditAmount">): string;
export function planImport(parsed: ParsedProduct[], existing: ExistingProduct[]): ImportPlan;
```

- [ ] **Step 1: Teste que falha**

`src/lib/xlsx/import-plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dedupKey, planImport } from "./import-plan";
import type { ParsedProduct } from "./parse-consorcio";

const base: ParsedProduct = {
  productName: "Imóvel IE600 – 240m",
  productCode: "IE600",
  creditAmount: "600000.00",
  termMonths: 240,
  totalAdministrationFeePercent: "26.800",
  first12InstallmentAmount: "3820.00",
  regularInstallmentAmount: "3220.00",
};

describe("dedupKey", () => {
  it("é estável por código+prazo+carta", () => {
    expect(dedupKey(base)).toBe("IE600|240|600000.00");
  });
});

describe("planImport", () => {
  it("tudo novo → insere tudo", () => {
    const plan = planImport([base], []);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(0);
  });

  it("reimportação idêntica → tudo unchanged (idempotência)", () => {
    const plan = planImport([base], [{ ...base, id: "x1" }]);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(1);
  });

  it("mesma chave com campo alterado → update", () => {
    const changed = { ...base, regularInstallmentAmount: "3200.00" };
    const plan = planImport([changed], [{ ...base, id: "x1" }]);
    expect(plan.toUpdate).toEqual([{ id: "x1", data: changed }]);
    expect(plan.toInsert).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL.

- [ ] **Step 3: Implementar**

`src/lib/xlsx/import-plan.ts`:

```ts
import type { ParsedProduct } from "./parse-consorcio";

export type ExistingProduct = ParsedProduct & { id: string };

export type ImportPlan = {
  toInsert: ParsedProduct[];
  toUpdate: { id: string; data: ParsedProduct }[];
  unchanged: ParsedProduct[];
};

export function dedupKey(p: Pick<ParsedProduct, "productCode" | "termMonths" | "creditAmount">): string {
  return `${p.productCode}|${p.termMonths}|${p.creditAmount}`;
}

const COMPARED_FIELDS = [
  "productName", "totalAdministrationFeePercent",
  "first12InstallmentAmount", "regularInstallmentAmount",
] as const;

export function planImport(parsed: ParsedProduct[], existing: ExistingProduct[]): ImportPlan {
  const byKey = new Map(existing.map((e) => [dedupKey(e), e]));
  const plan: ImportPlan = { toInsert: [], toUpdate: [], unchanged: [] };
  for (const p of parsed) {
    const found = byKey.get(dedupKey(p));
    if (!found) {
      plan.toInsert.push(p);
    } else if (COMPARED_FIELDS.some((f) => p[f] !== found[f])) {
      plan.toUpdate.push({ id: found.id, data: p });
    } else {
      plan.unchanged.push(p);
    }
  }
  return plan;
}
```

- [ ] **Step 4: Rodar testes** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/xlsx/
git commit -m "feat: plano de importação puro com dedup e idempotência

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Script `pnpm import:xlsx` + produtos demo de veículo + fix do seed

**Files:**
- Create: `scripts/import-xlsx.ts`
- Modify: `scripts/seed.ts` (checar erros dos upserts — finding Minor da Fase 1; adicionar 8 produtos demo de veículo), `package.json` (script `import:xlsx`)

**Interfaces:**
- Consumes: `parseConsorcioXlsx`, `planImport`, `dedupKey` (Tasks 2–3); org demo "Soren Consórcios" (seed F1).
- Produces: comando `pnpm import:xlsx references/consorcio.xlsx` idempotente com relatório em stdout; 8 produtos `vehicle` com `is_demo=true` no seed. Campos fixos da importação: `category='property'`, `administrator_name='Não informada (planilha)'`, `correction_index='IGPM'`, `correction_frequency_months=12`, `reserve_fund_percent='2.000'`, `status='active'`, `is_demo=false`.

- [ ] **Step 1: Escrever `scripts/import-xlsx.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { parseConsorcioXlsx } from "../src/lib/xlsx/parse-consorcio";
import { planImport, type ExistingProduct } from "../src/lib/xlsx/import-plan";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const FIXED = {
  category: "property",
  administrator_name: "Não informada (planilha)",
  correction_index: "IGPM",
  correction_frequency_months: 12,
  reserve_fund_percent: "2.000",
  status: "active",
  is_demo: false,
} as const;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Uso: pnpm import:xlsx <arquivo.xlsx>");

  const { data: org, error: orgErr } = await admin
    .from("organizations").select("id").eq("name", "Soren Consórcios").single();
  if (orgErr || !org) throw new Error("Organização demo não encontrada — rode pnpm db:seed antes.");

  const { products, invalidRows } = await parseConsorcioXlsx(filePath);

  const { data: existingRows, error: exErr } = await admin
    .from("consortium_products")
    .select("id, product_name, product_code, credit_amount, term_months, total_administration_fee_percent, first_12_installment_amount, regular_installment_amount")
    .eq("organization_id", org.id)
    .eq("category", "property")
    .eq("is_demo", false);
  if (exErr) throw exErr;

  const existing: ExistingProduct[] = (existingRows ?? []).map((r) => ({
    id: r.id,
    productName: r.product_name,
    productCode: r.product_code,
    creditAmount: r.credit_amount,
    termMonths: r.term_months,
    totalAdministrationFeePercent: r.total_administration_fee_percent,
    first12InstallmentAmount: r.first_12_installment_amount,
    regularInstallmentAmount: r.regular_installment_amount,
  }));

  const plan = planImport(products, existing);
  const errors: string[] = [];

  for (const p of plan.toInsert) {
    const { error } = await admin.from("consortium_products").insert({
      organization_id: org.id,
      product_name: p.productName,
      product_code: p.productCode,
      credit_amount: p.creditAmount,
      term_months: p.termMonths,
      total_administration_fee_percent: p.totalAdministrationFeePercent,
      first_12_installment_amount: p.first12InstallmentAmount,
      regular_installment_amount: p.regularInstallmentAmount,
      ...FIXED,
    });
    if (error) errors.push(`INSERT ${p.productName}: ${error.message}`);
  }
  for (const u of plan.toUpdate) {
    const { error } = await admin.from("consortium_products").update({
      product_name: u.data.productName,
      total_administration_fee_percent: u.data.totalAdministrationFeePercent,
      first_12_installment_amount: u.data.first12InstallmentAmount,
      regular_installment_amount: u.data.regularInstallmentAmount,
    }).eq("id", u.id);
    if (error) errors.push(`UPDATE ${u.data.productName}: ${error.message}`);
  }

  console.log("=== Relatório de importação ===");
  console.log(`Arquivo: ${filePath}`);
  console.log(`Inseridos:  ${plan.toInsert.length - errors.filter((e) => e.startsWith("INSERT")).length}`);
  console.log(`Atualizados: ${plan.toUpdate.length - errors.filter((e) => e.startsWith("UPDATE")).length}`);
  console.log(`Ignorados (sem mudança): ${plan.unchanged.length}`);
  console.log(`Linhas inválidas: ${invalidRows.length}`);
  invalidRows.forEach((r) => console.log(`  - linha ${r.rowNumber}: ${r.reason}`));
  console.log(`Erros: ${errors.length}`);
  errors.forEach((e) => console.log(`  - ${e}`));
  if (errors.length > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Adicionar ao `package.json`: `"import:xlsx": "tsx scripts/import-xlsx.ts"`.

- [ ] **Step 2: Atualizar `scripts/seed.ts`**

(a) Checar erro nos upserts existentes de `profiles` e `system_settings` (finding Minor F1):

```ts
const { error: profErr } = await admin.from("profiles").upsert({ ... });
if (profErr) throw profErr;
// idem para system_settings:
const { error: setErr } = await admin.from("system_settings").upsert(..., ...);
if (setErr) throw setErr;
```

(b) Adicionar produtos demo de veículo após os índices (idempotente por verificação prévia):

```ts
const VEHICLE_DEMOS = [
  { code: "VD040", credit: "40000.00", term: 48, fee: "14.000" },
  { code: "VD050", credit: "50000.00", term: 48, fee: "14.000" },
  { code: "VD060", credit: "60000.00", term: 60, fee: "15.000" },
  { code: "VD080", credit: "80000.00", term: 60, fee: "15.000" },
  { code: "VD100", credit: "100000.00", term: 60, fee: "15.000" },
  { code: "VD120", credit: "120000.00", term: 60, fee: "16.000" },
  { code: "VD150", credit: "150000.00", term: 60, fee: "16.000" },
  { code: "VD180", credit: "180000.00", term: 60, fee: "16.000" },
];
// parcela regular demo = credit × (1 + fee% + 2%) ÷ term, mesma regra da planilha,
// calculada com decimal.js; first_12 = regular + 0.1% × credit (regra da planilha)
import Decimal from "decimal.js"; // no topo do arquivo
for (const v of VEHICLE_DEMOS) {
  const { data: exists } = await admin.from("consortium_products").select("id")
    .eq("organization_id", orgId).eq("product_code", v.code).eq("is_demo", true).maybeSingle();
  if (exists) continue;
  const credit = new Decimal(v.credit);
  const regular = credit.times(new Decimal(1).plus(new Decimal(v.fee).div(100)).plus("0.02")).div(v.term);
  const first12 = regular.plus(credit.times("0.001"));
  const { error } = await admin.from("consortium_products").insert({
    organization_id: orgId,
    product_name: `Veículo ${v.code} – ${v.term}m (demo)`,
    product_code: v.code,
    category: "vehicle",
    administrator_name: "Demo",
    credit_amount: v.credit,
    term_months: v.term,
    total_administration_fee_percent: v.fee,
    reserve_fund_percent: "2.000",
    first_12_installment_amount: first12.toFixed(2),
    regular_installment_amount: regular.toFixed(2),
    correction_index: "IPCA",
    correction_frequency_months: 12,
    status: "active",
    is_demo: true,
  });
  if (error) throw error;
}
```

- [ ] **Step 3: Rodar importação DUAS vezes (idempotência)**

```bash
pnpm import:xlsx references/consorcio.xlsx
pnpm import:xlsx references/consorcio.xlsx
pnpm db:seed
```

Expected: 1ª execução `Inseridos: 63`; 2ª execução `Inseridos: 0 / Ignorados: 63`. Seed adiciona 8 veículos demo; re-rodar seed não duplica. Verificar via psql: `select category, is_demo, count(*) from consortium_products group by 1,2;` → property/false=63, vehicle/true=8.

- [ ] **Step 4: `pnpm lint && pnpm typecheck && pnpm test`** → verdes.

- [ ] **Step 5: Commit**

```bash
git add scripts/ package.json src/lib/xlsx/
git commit -m "feat: importador XLSX idempotente com relatório + produtos demo de veículo + fix seed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Repository e Server Actions de produtos (com auditoria)

**Files:**
- Create: `src/repositories/products.ts`, `src/repositories/audit.ts`, `src/features/products/schema.ts`, `src/features/products/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (F1), `getCurrentProfile` (F1).
- Produces:

```ts
// src/repositories/products.ts
export type Product = {
  id: string; productName: string; productCode: string; administratorName: string;
  category: "property" | "vehicle" | "other";
  creditAmount: string; termMonths: number;
  totalAdministrationFeePercent: string;
  first12InstallmentAmount: string | null; regularInstallmentAmount: string;
  correctionIndex: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
  status: "draft" | "active" | "inactive" | "archived"; isDemo: boolean;
};
export type ProductFilters = {
  category?: "property" | "vehicle" | "other";
  status?: "active" | "inactive" | "draft" | "archived";
  search?: string; // product_name ou product_code, ilike
};
export async function listProducts(filters: ProductFilters): Promise<Product[]>;
export async function setProductStatus(id: string, status: "active" | "inactive"): Promise<void>;
// src/features/products/actions.ts
export async function toggleProductStatus(formData: FormData): Promise<void>; // valida com Zod, exige staff, audita
```

- [ ] **Step 1: Repository**

`src/repositories/products.ts`:

```ts
import { createServerSupabase } from "@/lib/supabase/server";

export type Product = {
  id: string; productName: string; productCode: string; administratorName: string;
  category: "property" | "vehicle" | "other";
  creditAmount: string; termMonths: number;
  totalAdministrationFeePercent: string;
  first12InstallmentAmount: string | null; regularInstallmentAmount: string;
  correctionIndex: "IGPM" | "IPCA" | "INCC" | "NONE" | "CUSTOM";
  status: "draft" | "active" | "inactive" | "archived"; isDemo: boolean;
};

export type ProductFilters = {
  category?: Product["category"];
  status?: Product["status"];
  search?: string;
};

const COLUMNS = "id, product_name, product_code, administrator_name, category, credit_amount, term_months, total_administration_fee_percent, first_12_installment_amount, regular_installment_amount, correction_index, status, is_demo";

type Row = {
  id: string; product_name: string; product_code: string; administrator_name: string;
  category: Product["category"]; credit_amount: string; term_months: number;
  total_administration_fee_percent: string; first_12_installment_amount: string | null;
  regular_installment_amount: string; correction_index: Product["correctionIndex"];
  status: Product["status"]; is_demo: boolean;
};

function toProduct(r: Row): Product {
  return {
    id: r.id, productName: r.product_name, productCode: r.product_code,
    administratorName: r.administrator_name, category: r.category,
    creditAmount: r.credit_amount, termMonths: r.term_months,
    totalAdministrationFeePercent: r.total_administration_fee_percent,
    first12InstallmentAmount: r.first_12_installment_amount,
    regularInstallmentAmount: r.regular_installment_amount,
    correctionIndex: r.correction_index, status: r.status, isDemo: r.is_demo,
  };
}

/** Lista produtos da organização do usuário (RLS aplica o filtro de org). */
export async function listProducts(filters: ProductFilters): Promise<Product[]> {
  const supabase = await createServerSupabase();
  let q = supabase.from("consortium_products").select(COLUMNS)
    .order("category").order("credit_amount", { ascending: false }).order("term_months");
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.search) q = q.or(`product_name.ilike.%${filters.search}%,product_code.ilike.%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Row[]).map(toProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("consortium_products").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toProduct(data as Row) : null;
}

/** RLS (policy products_write) garante que apenas admin/manager conseguem. */
export async function setProductStatus(id: string, status: "active" | "inactive"): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("consortium_products").update({ status }).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Auditoria**

`src/repositories/audit.ts`:

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";

export async function logAudit(params: {
  action: string;
  entityType: string;
  entityId?: string;
  previousState?: unknown;
  newState?: unknown;
}): Promise<void> {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: profile.organizationId,
    user_id: profile.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    previous_state: params.previousState ?? null,
    new_state: params.newState ?? null,
  });
  // Auditoria não pode derrubar a operação principal; falha é logada no servidor.
  if (error) console.error("audit_logs insert falhou:", error.message);
}
```

- [ ] **Step 3: Schema Zod + Server Action**

`src/features/products/schema.ts`:

```ts
import { z } from "zod";

export const toggleStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

/** Cadastro manual (staff). Valores monetários chegam como string "1234.56"; percentuais em pontos. */
export const createProductSchema = z.object({
  productName: z.string().min(3, "Nome muito curto"),
  productCode: z.string().min(2, "Código muito curto"),
  administratorName: z.string().min(2, "Informe a administradora"),
  category: z.enum(["property", "vehicle", "other"]),
  creditAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (use 1234.56)"),
  termMonths: z.coerce.number().int().positive("Prazo deve ser positivo"),
  totalAdministrationFeePercent: z.string().regex(/^\d+(\.\d{1,3})?$/, "Taxa inválida (pontos percentuais)"),
  regularInstallmentAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido"),
  first12InstallmentAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido").optional().or(z.literal("")),
  correctionIndex: z.enum(["IGPM", "IPCA", "INCC", "NONE", "CUSTOM"]),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;
```

`src/features/products/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/repositories/profiles";
import { getProduct, setProductStatus } from "@/repositories/products";
import { logAudit } from "@/repositories/audit";
import { toggleStatusSchema } from "./schema";

export async function toggleProductStatus(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") throw new Error("Sem permissão");
  const { id, status } = toggleStatusSchema.parse(Object.fromEntries(formData));
  const before = await getProduct(id);
  if (!before) throw new Error("Produto não encontrado");
  await setProductStatus(id, status);
  await logAudit({
    action: "product.status_change",
    entityType: "consortium_products",
    entityId: id,
    previousState: { status: before.status },
    newState: { status },
  });
  revalidatePath("/produtos");
}

export type CreateProductState = { error?: string; success?: boolean };

export async function createProduct(_prev: CreateProductState | undefined, formData: FormData): Promise<CreateProductState> {
  const profile = await getCurrentProfile();
  if (profile.role === "consultant") return { error: "Sem permissão" };
  const parsed = createProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const id = await insertProduct({
    productName: d.productName, productCode: d.productCode,
    administratorName: d.administratorName, category: d.category,
    creditAmount: d.creditAmount, termMonths: d.termMonths,
    totalAdministrationFeePercent: d.totalAdministrationFeePercent,
    regularInstallmentAmount: d.regularInstallmentAmount,
    first12InstallmentAmount: d.first12InstallmentAmount || null,
    correctionIndex: d.correctionIndex,
  });
  await logAudit({ action: "product.create", entityType: "consortium_products", entityId: id, newState: parsed.data });
  revalidatePath("/produtos");
  return { success: true };
}
```

(Importar `createProductSchema` de `./schema` e `insertProduct` do repository.)

- [ ] **Step 4: `insertProduct` no repository**

Acrescentar a `src/repositories/products.ts`:

```ts
import { getCurrentProfile } from "@/repositories/profiles"; // no topo

export type NewProduct = {
  productName: string; productCode: string; administratorName: string;
  category: Product["category"]; creditAmount: string; termMonths: number;
  totalAdministrationFeePercent: string; regularInstallmentAmount: string;
  first12InstallmentAmount: string | null; correctionIndex: Product["correctionIndex"];
};

/** Insere produto manual (status active, is_demo false). RLS restringe a staff. Retorna o id. */
export async function insertProduct(p: NewProduct): Promise<string> {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("consortium_products").insert({
    organization_id: profile.organizationId,
    product_name: p.productName, product_code: p.productCode,
    administrator_name: p.administratorName, category: p.category,
    credit_amount: p.creditAmount, term_months: p.termMonths,
    total_administration_fee_percent: p.totalAdministrationFeePercent,
    regular_installment_amount: p.regularInstallmentAmount,
    first_12_installment_amount: p.first12InstallmentAmount,
    correction_index: p.correctionIndex,
    correction_frequency_months: 12,
    status: "active", is_demo: false,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}
```

- [ ] **Step 5: `pnpm lint && pnpm typecheck && pnpm test`** → verdes.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/ src/features/products/
git commit -m "feat: repository de produtos, cadastro manual e status com Zod e auditoria

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Página de produtos — listagem, filtros, ativar/inativar

**Files:**
- Modify: `src/app/(app)/produtos/page.tsx` (substituir placeholder)
- Create: `src/features/products/products-table.tsx`, `src/features/products/products-filters.tsx`

**Interfaces:**
- Consumes: `listProducts`, `Product`, `ProductFilters` (Task 5), `toggleProductStatus` (Task 5), `formatCurrency`/`formatPercent` (F1), `getCurrentProfile` (F1).
- Produces: rota `/produtos` funcional; filtros via `searchParams` (`?categoria=&status=&busca=`); botão Ativar/Inativar visível só para admin/manager.

- [ ] **Step 1: Página (Server Component)**

`src/app/(app)/produtos/page.tsx`:

```tsx
import { listProducts, type ProductFilters } from "@/repositories/products";
import { getCurrentProfile } from "@/repositories/profiles";
import { ProductsFilters } from "@/features/products/products-filters";
import { ProductsTable } from "@/features/products/products-table";

const CATEGORY_VALUES = ["property", "vehicle", "other"] as const;
const STATUS_VALUES = ["active", "inactive", "draft", "archived"] as const;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; status?: string; busca?: string }>;
}) {
  const params = await searchParams;
  const filters: ProductFilters = {
    category: CATEGORY_VALUES.find((c) => c === params.categoria),
    status: STATUS_VALUES.find((s) => s === params.status),
    search: params.busca || undefined,
  };
  const [products, profile] = await Promise.all([listProducts(filters), getCurrentProfile()]);
  const canManage = profile.role !== "consultant";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Produtos</h1>
        <p className="text-muted-foreground">{products.length} produto(s) no catálogo</p>
      </div>
      <ProductsFilters current={params} />
      <ProductsTable products={products} canManage={canManage} />
    </div>
  );
}
```

- [ ] **Step 2: Filtros (client, navegação por querystring)**

`src/features/products/products-filters.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { value: "", label: "Todas" },
  { value: "property", label: "Imóvel" },
  { value: "vehicle", label: "Veículo" },
  { value: "other", label: "Outros" },
];
const STATUSES = [
  { value: "", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

export function ProductsFilters({ current }: { current: { categoria?: string; status?: string; busca?: string } }) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(next: Partial<typeof current>) {
    const merged = { ...current, ...next };
    const qs = new URLSearchParams();
    if (merged.categoria) qs.set("categoria", merged.categoria);
    if (merged.status) qs.set("status", merged.status);
    if (merged.busca) qs.set("busca", merged.busca);
    router.replace(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar por nome ou código..."
        className="max-w-xs"
        defaultValue={current.busca ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply({ busca: e.currentTarget.value });
        }}
      />
      <div className="flex gap-1" role="group" aria-label="Categoria">
        {CATEGORIES.map((c) => (
          <Button key={c.value} size="sm"
            variant={(current.categoria ?? "") === c.value ? "default" : "outline"}
            onClick={() => apply({ categoria: c.value })}>
            {c.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-1" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <Button key={s.value} size="sm"
            variant={(current.status ?? "") === s.value ? "default" : "outline"}
            onClick={() => apply({ status: s.value })}>
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tabela**

`src/features/products/products-table.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/format";
import { toggleProductStatus } from "./actions";
import type { Product } from "@/repositories/products";

const CATEGORY_LABEL: Record<Product["category"], string> = {
  property: "Imóvel", vehicle: "Veículo", other: "Outros",
};
const STATUS_LABEL: Record<Product["status"], string> = {
  active: "Ativo", inactive: "Inativo", draft: "Rascunho", archived: "Arquivado",
};

export function ProductsTable({ products, canManage }: { products: Product[]; canManage: boolean }) {
  if (products.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Nenhum produto encontrado. Rode a importação: <code>pnpm import:xlsx references/consorcio.xlsx</code></p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Carta</TableHead>
            <TableHead className="text-right">Prazo</TableHead>
            <TableHead className="text-right">Taxa adm</TableHead>
            <TableHead className="text-right">Parcela 1ª–12ª</TableHead>
            <TableHead className="text-right">Parcela mensal</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <span className="font-medium">{p.productName}</span>
                {p.isDemo && <Badge variant="outline" className="ml-2">demo</Badge>}
                <div className="text-xs text-muted-foreground">{p.productCode} · {p.administratorName}</div>
              </TableCell>
              <TableCell>{CATEGORY_LABEL[p.category]}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(p.creditAmount)}</TableCell>
              <TableCell className="text-right">{p.termMonths}m</TableCell>
              <TableCell className="text-right">{formatPercent(p.totalAdministrationFeePercent)}</TableCell>
              <TableCell className="text-right">{p.first12InstallmentAmount ? formatCurrency(p.first12InstallmentAmount) : "—"}</TableCell>
              <TableCell className="text-right">{formatCurrency(p.regularInstallmentAmount)}</TableCell>
              <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{STATUS_LABEL[p.status]}</Badge></TableCell>
              {canManage && (
                <TableCell>
                  <form action={toggleProductStatus}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === "active" ? "inactive" : "active"} />
                    <Button type="submit" size="sm" variant="outline">
                      {p.status === "active" ? "Inativar" : "Ativar"}
                    </Button>
                  </form>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Formulário de cadastro manual (dialog, staff-only)**

```bash
pnpm add react-hook-form @hookform/resolvers
```

Criar `src/features/products/product-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { createProduct } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: { name: string; label: string; placeholder?: string }[] = [
  { name: "productName", label: "Nome do produto", placeholder: "Imóvel XY 300 – 200m" },
  { name: "productCode", label: "Código", placeholder: "XY300" },
  { name: "administratorName", label: "Administradora" },
  { name: "creditAmount", label: "Valor da carta (ex.: 300000.00)" },
  { name: "termMonths", label: "Prazo (meses)" },
  { name: "totalAdministrationFeePercent", label: "Taxa adm total (pontos, ex.: 24.800)" },
  { name: "regularInstallmentAmount", label: "Parcela mensal (ex.: 1902.00)" },
  { name: "first12InstallmentAmount", label: "Parcela 1ª–12ª (opcional)" },
];

export function ProductForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createProduct, undefined);

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo produto</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cadastrar produto</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input id={f.name} name={f.name} placeholder={f.placeholder} required={f.name !== "first12InstallmentAmount"} />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="category">Categoria</Label>
            <select id="category" name="category" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm">
              <option value="property">Imóvel</option>
              <option value="vehicle">Veículo</option>
              <option value="other">Outros</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="correctionIndex">Índice de correção</Label>
            <select id="correctionIndex" name="correctionIndex" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm">
              <option value="IGPM">IGP-M</option>
              <option value="IPCA">IPCA</option>
              <option value="INCC">INCC</option>
              <option value="NONE">Nenhum</option>
              <option value="CUSTOM">Personalizado</option>
            </select>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Salvar produto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Na página `produtos/page.tsx`, renderizar `{canManage && <ProductForm />}` ao lado do título.

Nota: formulário nativo + server action + Zod já cobre a validação; `react-hook-form` fica instalado como padrão do stack para os formulários maiores das fases 3–5 (se o dialog acima ficar melhor com RHF, o implementador pode usá-lo — validação final continua no servidor).

- [ ] **Step 5: Verificação manual**

`pnpm dev` + sessão autenticada (método do task-8-report): admin vê 71 produtos (63 + 8 demo), filtros funcionam por querystring, Inativar/Ativar altera o status e gera linha em `audit_logs`, cadastro manual cria produto visível na lista; consultora ana@ vê a tabela sem botões de ação nem "Novo produto". Derrubar o dev server.

- [ ] **Step 6: `pnpm lint && pnpm typecheck && pnpm test`** → verdes.

- [ ] **Step 7: Commit**

```bash
git add src/app/ src/features/products/ package.json pnpm-lock.yaml
git commit -m "feat: página de produtos com listagem, filtros, cadastro manual e ativar/inativar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Gate da Fase 2 + push

**Files:**
- Modify: `PLANS.md`, `README.md` (seção de importação sai de "disponível na Fase 2" para instruções reais)

**Interfaces:**
- Consumes: todas as tasks anteriores.

- [ ] **Step 1: Gate completo** — `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → tudo verde.

- [ ] **Step 2: Verificação de idempotência final** — `pnpm import:xlsx references/consorcio.xlsx` (3ª execução) → `Inseridos: 0 / Ignorados: 63`; contagens no banco inalteradas (property/false=63, vehicle/true=8).

- [ ] **Step 3: Atualizar PLANS.md (Fase 2 concluída, com data e entregas) e README.md (instruções reais de importação).**

- [ ] **Step 4: Commit + push**

```bash
git add PLANS.md README.md
git commit -m "docs: Fase 2 (Produtos) concluída — registro no PLANS.md e README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

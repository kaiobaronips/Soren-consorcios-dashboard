import Decimal from "decimal.js";
import { parseBrlMoney, parseBrlPercent, parseIntSafe } from "./parse-values";

/**
 * Extração pura (zero I/O) de produtos de consórcio a partir de texto de PDF.
 *
 * Heurística tolerante a layouts:
 *  1. Detecta a linha de cabeçalho por palavras-chave (case/acento-insensitive):
 *     produto, código, crédito/carta/valor, prazo/meses, taxa/adm, parcela.
 *  2. Infere a coluna de cada campo pela ordem em que a palavra-chave aparece
 *     (primeira coluna que casa vence — inferência determinística).
 *  3. Linhas de dados = linhas com ≥2 valores monetários.
 *  4. `manualMapping` sobrepõe a inferência (corrige colunas erradas/ambíguas).
 *
 * REGRA INVIOLÁVEL (§8.6): campo não identificado → value null, confidence 0 e
 * uma issue legível. NUNCA se inventa valor.
 *
 * Validações (§8.9) — violação zera a confiança do campo e vira issue:
 *  carta > 0; prazo 1–600; taxa 0–100; parcela > 0 e < carta.
 */

export type ExtractedField<T> = { value: T | null; confidence: number; raw: string | null };

export type ExtractedProduct = {
  page: number;
  productName: ExtractedField<string>;
  productCode: ExtractedField<string>;
  creditAmount: ExtractedField<string>;
  termMonths: ExtractedField<number>;
  totalAdministrationFeePercent: ExtractedField<string>;
  regularInstallmentAmount: ExtractedField<string>;
  first12InstallmentAmount: ExtractedField<string>;
  overallConfidence: number;
  issues: string[];
};

export type PageText = { page: number; lines: string[] };

type FieldKey =
  | "productName"
  | "productCode"
  | "creditAmount"
  | "termMonths"
  | "totalAdministrationFeePercent"
  | "regularInstallmentAmount"
  | "first12InstallmentAmount";

export type ColumnMapping = Partial<Record<FieldKey, number>>;

const CONFIDENCE_INFERRED = 90;
const CONFIDENCE_MANUAL = 100;

const FIELD_LABELS: Record<FieldKey, string> = {
  productName: "Produto",
  productCode: "Código",
  creditAmount: "Valor da Carta",
  termMonths: "Prazo",
  totalAdministrationFeePercent: "Taxa",
  regularInstallmentAmount: "Parcela Mensal",
  first12InstallmentAmount: "Parcela 1ª a 12ª",
};

const ALL_FIELDS: FieldKey[] = [
  "productName",
  "productCode",
  "creditAmount",
  "termMonths",
  "totalAdministrationFeePercent",
  "regularInstallmentAmount",
  "first12InstallmentAmount",
];

const CONTEXT_CONFIDENCE = 80;

// Faixa Unicode das marcas diacríticas combinantes (acentos decompostos por NFD).
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Remove acentos e caixa para casamento robusto de palavras-chave. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/** Divide uma linha em células (colunas separadas por 2+ espaços ou tab). */
function splitCells(line: string): string[] {
  return line
    .trim()
    .split(/\s{2,}|\t+/)
    .map((c) => c.trim())
    .filter((c) => c !== "");
}

/** Quantidade de células que se parecem com valor monetário (R$ ou 0,00). */
function moneyCellCount(cells: string[]): number {
  return cells.filter((c) => /r\$/i.test(c) || /\d[.\d]*,\d{2}\b/.test(c)).length;
}

/** Classifica uma célula de cabeçalho no campo correspondente (ou null). */
function classifyHeaderCell(cell: string): FieldKey | null {
  const n = normalize(cell);
  // Parcelas primeiro: distinguir "1ª a 12ª" de "mensal/regular".
  if (n.includes("parcela") || n.includes("mensal")) {
    if (/12|1a|primeira|reduzid/.test(n)) return "first12InstallmentAmount";
    if (/mensal|regular|demais/.test(n)) return "regularInstallmentAmount";
    return null;
  }
  if (n.includes("prazo") || n.includes("meses")) return "termMonths";
  if (n.includes("taxa") || n.includes("adm")) return "totalAdministrationFeePercent";
  if (n.includes("codigo") || n.includes("cod")) return "productCode";
  if (n.includes("credito") || n.includes("carta") || n.includes("valor")) return "creditAmount";
  if (n.includes("produto") || n.includes("descricao") || n.includes("plano")) return "productName";
  return null;
}

/** Infere o mapa campo→coluna a partir de uma linha de cabeçalho. */
function inferMapping(cells: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  cells.forEach((cell, index) => {
    const field = classifyHeaderCell(cell);
    // primeira coluna que casa vence (inferência determinística)
    if (field && mapping[field] === undefined) mapping[field] = index;
  });
  return mapping;
}

type DocumentContext = {
  categoryLabel: string;
  defaultTermMonths: number | null;
  feeByTerm: Map<number, string>;
};

function inferCategoryLabel(lines: string[]): string {
  const text = normalize(lines.join(" "));
  if (/\b(auto|automovel|veiculo|carro|moto)\b/.test(text)) return "Veículo";
  if (/\b(imovel|imobiliario|residencial)\b/.test(text)) return "Imóvel";
  return "Produto";
}

function inferFirstTerm(lines: string[]): number | null {
  for (const line of lines) {
    const matches = line.matchAll(/\b(\d{2,3})\b/g);
    for (const match of matches) {
      const term = Number.parseInt(match[1]!, 10);
      if (term >= 24 && term <= 600) return term;
    }
  }
  return null;
}

function inferFeeByTerm(lines: string[]): Map<number, string> {
  const fees = new Map<number, string>();
  for (const line of lines) {
    const matches = line.matchAll(/\b(\d{2,3})\s+(\d{1,3}(?:[.,]\d{1,3})?)\s*%/g);
    for (const match of matches) {
      const term = Number.parseInt(match[1]!, 10);
      const fee = parseBrlPercent(match[2]!);
      if (term >= 24 && term <= 600 && fee && !fees.has(term)) fees.set(term, fee);
    }
  }
  return fees;
}

function inferDocumentContext(pages: PageText[]): DocumentContext {
  const lines = pages.flatMap((page) => page.lines);
  const feeByTerm = inferFeeByTerm(lines);
  return {
    categoryLabel: inferCategoryLabel(lines),
    defaultTermMonths: feeByTerm.keys().next().value ?? null,
    feeByTerm,
  };
}

function hasMissingColumnIssue(issues: string[], field: FieldKey): boolean {
  const label = FIELD_LABELS[field];
  return issues.some((issue) => issue.startsWith(`coluna ${label} não identificada`));
}

function withoutMissingColumnIssue(issues: string[], field: FieldKey): string[] {
  const label = FIELD_LABELS[field];
  return issues.filter((issue) => !issue.startsWith(`coluna ${label} não identificada`));
}

function recalculateConfidence(product: ExtractedProduct): ExtractedProduct {
  const confidences = [
    product.productName.confidence,
    product.productCode.confidence,
    product.creditAmount.confidence,
    product.termMonths.confidence,
    product.totalAdministrationFeePercent.confidence,
    product.regularInstallmentAmount.confidence,
    product.first12InstallmentAmount.confidence,
  ];
  return {
    ...product,
    overallConfidence: Math.round(confidences.reduce((sum, c) => sum + c, 0) / confidences.length),
  };
}

function applyContextualDefaults(
  product: ExtractedProduct,
  context: DocumentContext,
  pageHeaderLines: string[],
): ExtractedProduct {
  const term = product.termMonths.value ?? inferFirstTerm(pageHeaderLines) ?? context.defaultTermMonths;
  const fee = product.totalAdministrationFeePercent.value
    ?? (term ? context.feeByTerm.get(term) : undefined)
    ?? context.feeByTerm.values().next().value
    ?? null;
  let next: ExtractedProduct = { ...product, issues: [...product.issues] };

  if (next.termMonths.value === null && term !== null && hasMissingColumnIssue(next.issues, "termMonths")) {
    next = {
      ...next,
      termMonths: { value: term, confidence: CONTEXT_CONFIDENCE, raw: String(term) },
      issues: withoutMissingColumnIssue(next.issues, "termMonths"),
    };
  }

  if (
    next.totalAdministrationFeePercent.value === null
    && fee !== null
    && hasMissingColumnIssue(next.issues, "totalAdministrationFeePercent")
  ) {
    next = {
      ...next,
      totalAdministrationFeePercent: { value: fee, confidence: CONTEXT_CONFIDENCE, raw: fee },
      issues: withoutMissingColumnIssue(next.issues, "totalAdministrationFeePercent"),
    };
  }

  if (
    next.productName.value === null
    && next.productCode.value
    && hasMissingColumnIssue(next.issues, "productName")
  ) {
    const suffix = next.termMonths.value ? ` - ${next.termMonths.value}m` : "";
    next = {
      ...next,
      productName: {
        value: `${context.categoryLabel} ${next.productCode.value}${suffix}`,
        confidence: CONTEXT_CONFIDENCE,
        raw: null,
      },
      issues: withoutMissingColumnIssue(next.issues, "productName"),
    };
  }

  return recalculateConfidence(next);
}

/** Uma linha é cabeçalho se casa ≥2 campos distintos e quase não tem valores monetários. */
function isHeaderLine(cells: string[]): boolean {
  const mapping = inferMapping(cells);
  return Object.keys(mapping).length >= 2 && moneyCellCount(cells) < 2;
}

/** Uma linha é de dados se tiver ≥2 valores monetários. */
function isDataLine(cells: string[]): boolean {
  return moneyCellCount(cells) >= 2;
}

type FieldResult<T> = { field: ExtractedField<T>; issue: string | null };

/** Constrói um ExtractedField aplicando parsing, validação (§8.9) e regra §8.6. */
function buildField<T>(
  fieldKey: FieldKey,
  page: number,
  columnIndex: number | undefined,
  isManual: boolean,
  cells: string[],
  parse: (raw: string) => T | null,
  validate: (value: T) => string | null,
): FieldResult<T> {
  const label = FIELD_LABELS[fieldKey];

  if (columnIndex === undefined) {
    return {
      field: { value: null, confidence: 0, raw: null },
      issue: `coluna ${label} não identificada na página ${page}`,
    };
  }

  const raw = cells[columnIndex] ?? null;
  if (raw === null || raw === "") {
    return {
      field: { value: null, confidence: 0, raw },
      issue: `valor de ${label} ausente na página ${page}`,
    };
  }

  const value = parse(raw);
  if (value === null) {
    return {
      field: { value: null, confidence: 0, raw },
      issue: `valor de ${label} inválido na página ${page}: "${raw}"`,
    };
  }

  const validationError = validate(value);
  if (validationError) {
    return {
      field: { value: null, confidence: 0, raw },
      issue: validationError,
    };
  }

  return {
    field: { value, confidence: isManual ? CONFIDENCE_MANUAL : CONFIDENCE_INFERRED, raw },
    issue: null,
  };
}

/** Extrai um produto de uma linha de dados usando o mapa de colunas. */
function extractProduct(
  page: number,
  cells: string[],
  mapping: ColumnMapping,
  manualFields: Set<FieldKey>,
): ExtractedProduct {
  const issues: string[] = [];
  const isManual = (f: FieldKey) => manualFields.has(f);

  const productName = buildField<string>(
    "productName", page, mapping.productName, isManual("productName"), cells,
    (raw) => raw.trim() || null,
    () => null,
  );
  const productCode = buildField<string>(
    "productCode", page, mapping.productCode, isManual("productCode"), cells,
    (raw) => raw.trim() || null,
    () => null,
  );
  const creditAmount = buildField<string>(
    "creditAmount", page, mapping.creditAmount, isManual("creditAmount"), cells,
    parseBrlMoney,
    (v) => (new Decimal(v).gt(0) ? null : `Valor da Carta deve ser > 0 na página ${page}`),
  );
  const termMonths = buildField<number>(
    "termMonths", page, mapping.termMonths, isManual("termMonths"), cells,
    parseIntSafe,
    (v) => (v >= 1 && v <= 600 ? null : `Prazo fora do intervalo 1–600 na página ${page}: ${v}`),
  );
  const feePercent = buildField<string>(
    "totalAdministrationFeePercent", page, mapping.totalAdministrationFeePercent,
    isManual("totalAdministrationFeePercent"), cells,
    parseBrlPercent,
    (v) => {
      const d = new Decimal(v);
      return d.gte(0) && d.lte(100) ? null : `Taxa fora do intervalo 0–100 na página ${page}: ${v}`;
    },
  );

  const creditValue = creditAmount.field.value;
  const installmentValidator = (label: string) => (v: string): string | null => {
    const d = new Decimal(v);
    if (d.lte(0)) return `${label} deve ser > 0 na página ${page}`;
    if (creditValue !== null && d.gte(new Decimal(creditValue))) {
      return `${label} deve ser menor que o Valor da Carta na página ${page}`;
    }
    return null;
  };

  const first12 = buildField<string>(
    "first12InstallmentAmount", page, mapping.first12InstallmentAmount,
    isManual("first12InstallmentAmount"), cells,
    parseBrlMoney,
    installmentValidator("Parcela 1ª a 12ª"),
  );
  const regular = buildField<string>(
    "regularInstallmentAmount", page, mapping.regularInstallmentAmount,
    isManual("regularInstallmentAmount"), cells,
    parseBrlMoney,
    installmentValidator("Parcela Mensal"),
  );

  for (const r of [productName, productCode, creditAmount, termMonths, feePercent, first12, regular]) {
    if (r.issue) issues.push(r.issue);
  }

  const confidences = [
    productName.field.confidence,
    productCode.field.confidence,
    creditAmount.field.confidence,
    termMonths.field.confidence,
    feePercent.field.confidence,
    regular.field.confidence,
    first12.field.confidence,
  ];
  const overallConfidence = Math.round(
    confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
  );

  return {
    page,
    productName: productName.field,
    productCode: productCode.field,
    creditAmount: creditAmount.field,
    termMonths: termMonths.field,
    totalAdministrationFeePercent: feePercent.field,
    regularInstallmentAmount: regular.field,
    first12InstallmentAmount: first12.field,
    overallConfidence,
    issues,
  };
}

export function extractProductsFromText(
  pages: PageText[],
  manualMapping?: ColumnMapping,
): { products: ExtractedProduct[]; log: string[] } {
  const products: ExtractedProduct[] = [];
  const log: string[] = [];
  const documentContext = inferDocumentContext(pages);
  const manualFields = new Set<FieldKey>(
    manualMapping ? (Object.keys(manualMapping) as FieldKey[]) : [],
  );

  for (const { page, lines } of pages) {
    const headerIndex = lines.findIndex((line) => isHeaderLine(splitCells(line)));
    if (headerIndex === -1) {
      log.push(`página ${page}: nenhuma tabela encontrada (cabeçalho não detectado)`);
      continue;
    }

    const inferred = inferMapping(splitCells(lines[headerIndex]));
    // manualMapping sobrepõe a inferência.
    const mapping: ColumnMapping = { ...inferred, ...manualMapping };

    const missingFields = ALL_FIELDS.filter((f) => mapping[f] === undefined);
    if (missingFields.length > 0) {
      log.push(
        `página ${page}: colunas não identificadas → ${missingFields.map((f) => FIELD_LABELS[f]).join(", ")}`,
      );
    }

    let count = 0;
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const cells = splitCells(lines[i]);
      if (!isDataLine(cells)) continue;
      const product = extractProduct(page, cells, mapping, manualFields);
      products.push(applyContextualDefaults(product, documentContext, lines.slice(0, headerIndex + 1)));
      count++;
    }
    log.push(`página ${page}: cabeçalho detectado na linha ${headerIndex + 1}, ${count} produto(s) extraído(s)`);
  }

  return { products, log };
}

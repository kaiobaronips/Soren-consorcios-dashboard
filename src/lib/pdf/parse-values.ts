import Decimal from "decimal.js";

/**
 * Normalização pura de valores em texto pt-BR extraídos de PDF.
 * Convenção pt-BR: "." é separador de milhar e "," é separador decimal.
 * Toda entrada inválida retorna `null` — NUNCA um valor inventado (prompt §8.6).
 */

/**
 * "R$ 600.000,00" / "600.000,00" / "3220" → "600000.00" (string NUMERIC(14,2)).
 * Remove "R$" e espaços, trata "." como milhar e "," como decimal.
 * Inválido → null.
 */
export function parseBrlMoney(raw: string): string | null {
  const cleaned = raw.replace(/r\$/gi, "").replace(/\s/g, "");
  if (cleaned === "") return null;
  if (!/^-?[\d.,]+$/.test(cleaned)) return null;
  // "." = milhar (removido); "," = decimal (vira ".")
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  try {
    return new Decimal(normalized).toFixed(2, Decimal.ROUND_HALF_UP);
  } catch {
    return null;
  }
}

/**
 * "26,8%" / "26,8" / "2" → "26.800" (string NUMERIC(6,3), pontos percentuais).
 * Remove "%" e espaços; com vírgula presente "." é milhar, sem vírgula "." é decimal.
 * Inválido → null.
 */
export function parseBrlPercent(raw: string): string | null {
  let cleaned = raw.replace(/%/g, "").replace(/\s/g, "");
  if (cleaned === "") return null;
  if (!/^-?[\d.,]+$/.test(cleaned)) return null;
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  try {
    return new Decimal(cleaned).toFixed(3, Decimal.ROUND_HALF_UP);
  } catch {
    return null;
  }
}

/**
 * "240" / "240x" / " 220 meses" → 240 / 220 (inteiro no começo da string).
 * Sem inteiro no começo → null.
 */
export function parseIntSafe(raw: string): number | null {
  const match = raw.trim().match(/^-?\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0], 10);
  return Number.isFinite(value) ? value : null;
}

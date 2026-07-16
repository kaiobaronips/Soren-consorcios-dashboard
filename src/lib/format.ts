const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PCT = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Formata valor monetário em BRL. Aceita number ou string decimal vinda do banco (NUMERIC chega como string). */
export function formatCurrency(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return BRL.format(n).replace(/ /g, " ");
}

/** Formata pontos percentuais (26.8 → "26,80%"). */
export function formatPercent(points: number | string): string {
  const n = typeof points === "string" ? Number(points) : points;
  return `${PCT.format(n)}%`;
}

/** Formata data como dd/MM/yyyy em America/Sao_Paulo. */
export function formatDate(date: Date | string): string {
  return DATE.format(typeof date === "string" ? new Date(date) : date);
}

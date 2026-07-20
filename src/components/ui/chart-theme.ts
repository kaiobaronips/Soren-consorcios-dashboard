/**
 * Tema visual compartilhado dos gráficos (Soren Graphite): todas as cores vêm
 * de tokens CSS, funcionando nos temas claro e escuro. Série principal em azul
 * (--chart-1), série de comparação em grafite (--chart-2).
 */
export const chartGridStroke = "var(--border)";

export const chartAxisTick = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
} as const;

export const chartTooltipContentStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.12)",
} as const;

export const chartTooltipLabelStyle = {
  color: "var(--muted-foreground)",
} as const;

export const chartSeries = {
  primary: "var(--chart-1)",
  comparison: "var(--chart-2)",
} as const;

/** Draw-in suave na montagem do gráfico ("vivo mas sóbrio"). */
export const chartLineAnimation = {
  isAnimationActive: true,
  animationDuration: 700,
  animationEasing: "ease-out",
} as const;

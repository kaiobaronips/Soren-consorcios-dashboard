/**
 * Barra de ação da página (estilo Attio): sem título/subtítulo — o contexto vem da
 * navegação lateral. Renderiza apenas a ação primária, alinhada à direita. Quando não
 * há ação, não ocupa espaço.
 */
export function PageHeader({ action }: { action?: React.ReactNode }) {
  if (!action) return null;
  return <div className="flex flex-wrap items-center justify-end gap-2">{action}</div>;
}

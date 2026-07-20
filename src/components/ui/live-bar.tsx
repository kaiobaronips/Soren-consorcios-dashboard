import { cn } from "@/lib/utils";

/**
 * Barra de progresso "viva" (Soren Graphite): largura animada por transição
 * CSS e pulso discreto quando em estado de alerta.
 */
export function LiveBar({
  percent,
  alert = false,
  className,
}: {
  /** 0–100 */
  percent: number;
  alert?: boolean;
  className?: string;
}) {
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="presentation"
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          alert ? "animate-bar-pulse bg-destructive" : "bg-primary",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

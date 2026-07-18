"use client";

import { Button } from "@/components/ui/button";

/** Botão de impressão do resumo. Some no layout impresso (print:hidden). */
export function PrintButton() {
  return (
    <Button size="sm" className="print:hidden" onClick={() => window.print()}>
      Imprimir
    </Button>
  );
}

import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import type { SavedSimulation } from "@/repositories/simulations";

type SnapshotProduct = { productName?: unknown };

function productNameOf(simulation: SavedSimulation): string {
  const snapshot = simulation.productSnapshot as SnapshotProduct | null;
  const name = snapshot?.productName;
  return typeof name === "string" ? name : "—";
}

/** Histórico de simulações de um cliente. Cada item abre o resumo imprimível. */
export function SimulationsHistory({ simulations }: { simulations: SavedSimulation[] }) {
  if (simulations.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma simulação salva ainda.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Carta projetada</TableHead>
            <TableHead>Mês/Ano selecionado</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Resumo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {simulations.map((s) => (
            <TableRow key={s.id} className="transition-colors hover:bg-muted/50">
              <TableCell className="font-medium">{productNameOf(s)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {s.projectedCreditAmount ? formatCurrency(s.projectedCreditAmount) : "—"}
              </TableCell>
              <TableCell>{s.selectedYear !== null ? `Ano ${s.selectedYear}` : "—"}</TableCell>
              <TableCell>{formatDate(s.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/simulacoes/${s.id}/resumo`} />}>
                  Ver resumo
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

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
    <div className="overflow-x-auto rounded-xl border bg-card">
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
            <TableRow key={p.id} className="transition-colors hover:bg-muted/50">
              <TableCell>
                <span className="font-medium">{p.productName}</span>
                {p.isDemo && <Badge variant="outline" className="ml-2">demo</Badge>}
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{p.productCode}</span> · {p.administratorName}
                </div>
              </TableCell>
              <TableCell>{CATEGORY_LABEL[p.category]}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.creditAmount)}</TableCell>
              <TableCell className="text-right tabular-nums">{p.termMonths}m</TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(p.totalAdministrationFeePercent)}</TableCell>
              <TableCell className="text-right tabular-nums">{p.first12InstallmentAmount ? formatCurrency(p.first12InstallmentAmount) : "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(p.regularInstallmentAmount)}</TableCell>
              <TableCell><Badge variant={p.status === "active" ? "success" : "secondary"}>{STATUS_LABEL[p.status]}</Badge></TableCell>
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

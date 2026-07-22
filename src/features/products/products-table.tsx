import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/operational/enterprise-ui";
import { formatCurrency, formatPercent } from "@/lib/format";
import { toggleProductStatus } from "./actions";
import type { Product } from "@/repositories/products";

const CATEGORY_LABEL: Record<Product["category"], string> = {
  property: "Imóvel", vehicle: "Veículo", other: "Outros",
};
const STATUS_LABEL: Record<Product["status"], string> = {
  active: "Ativo", inactive: "Inativo", draft: "Rascunho", archived: "Arquivado",
};

function getProductSourceLabel(product: Product): string {
  if (product.sourceDocumentId) return "Upload · Documento PDF";
  return "Adicionado manualmente";
}

export function ProductsTable({ products, canManage }: { products: Product[]; canManage: boolean }) {
  if (products.length === 0) {
    return <section className="enterprise-card py-12 text-center text-sm text-[#6f6f6f]">Nenhum produto encontrado.</section>;
  }
  return (
    <section className="enterprise-card overflow-hidden">
      <header className="enterprise-card-header">
        <h2 className="enterprise-card-title">Lista de produtos</h2>
        <span className="text-xs text-[#6f6f6f]">{products.length} registro(s)</span>
      </header>
      <div className="overflow-x-auto">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th className="text-right">Carta</th>
              <th className="text-right">Prazo</th>
              <th className="text-right">Taxa adm.</th>
              <th className="text-right">Parcela 1ª–12ª</th>
              <th className="text-right">Parcela mensal</th>
              <th>Status</th>
              {canManage && <th>Ação</th>}
            </tr>
          </thead>
          <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="font-medium">{p.productName}</span>
                {p.isDemo && <span className="ml-2 text-xs text-[#6f6f6f]">demo</span>}
                <div className="text-xs text-[#6f6f6f]">
                  {getProductSourceLabel(p)}
                </div>
              </td>
              <td>{CATEGORY_LABEL[p.category]}</td>
              <td className="text-right font-medium tabular-nums">{formatCurrency(p.creditAmount)}</td>
              <td className="text-right tabular-nums">{p.termMonths}m</td>
              <td className="text-right tabular-nums">{formatPercent(p.totalAdministrationFeePercent)}</td>
              <td className="text-right tabular-nums">{p.first12InstallmentAmount ? formatCurrency(p.first12InstallmentAmount) : "—"}</td>
              <td className="text-right tabular-nums">{formatCurrency(p.regularInstallmentAmount)}</td>
              <td><StatusBadge status={p.status === "active" ? "Ativo" : STATUS_LABEL[p.status]} /></td>
              {canManage && (
                <td>
                  <form action={toggleProductStatus}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === "active" ? "inactive" : "active"} />
                    <Button type="submit" className="h-8 rounded-sm border-[#c6c6c6] bg-white text-xs text-[#161616] hover:bg-[#f4f4f4]" variant="outline">
                      {p.status === "active" ? "Inativar" : "Ativar"}
                    </Button>
                  </form>
                </td>
              )}
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

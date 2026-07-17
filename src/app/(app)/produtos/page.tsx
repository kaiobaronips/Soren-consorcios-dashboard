import { listProducts, type ProductFilters } from "@/repositories/products";
import { getCurrentProfile } from "@/repositories/profiles";
import { ProductsFilters } from "@/features/products/products-filters";
import { ProductsTable } from "@/features/products/products-table";
import { ProductForm } from "@/features/products/product-form";

const CATEGORY_VALUES = ["property", "vehicle", "other"] as const;
const STATUS_VALUES = ["active", "inactive", "draft", "archived"] as const;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; status?: string; busca?: string }>;
}) {
  const params = await searchParams;
  const filters: ProductFilters = {
    category: CATEGORY_VALUES.find((c) => c === params.categoria),
    status: STATUS_VALUES.find((s) => s === params.status),
    search: params.busca || undefined,
  };
  const [products, profile] = await Promise.all([listProducts(filters), getCurrentProfile()]);
  const canManage = profile.role !== "consultant";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produtos</h1>
          <p className="text-muted-foreground">{products.length} produto(s) no catálogo</p>
        </div>
        {canManage && <ProductForm />}
      </div>
      <ProductsFilters current={params} />
      <ProductsTable products={products} canManage={canManage} />
    </div>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { value: "", label: "Todas" },
  { value: "property", label: "Imóvel" },
  { value: "vehicle", label: "Veículo" },
  { value: "other", label: "Outros" },
];
const STATUSES = [
  { value: "", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

export function ProductsFilters({ current }: { current: { categoria?: string; status?: string; busca?: string } }) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(next: Partial<typeof current>) {
    const merged = { ...current, ...next };
    const qs = new URLSearchParams();
    if (merged.categoria) qs.set("categoria", merged.categoria);
    if (merged.status) qs.set("status", merged.status);
    if (merged.busca) qs.set("busca", merged.busca);
    router.replace(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar por nome ou código..."
        className="max-w-xs"
        defaultValue={current.busca ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply({ busca: e.currentTarget.value });
        }}
      />
      <div className="flex gap-1" role="group" aria-label="Categoria">
        {CATEGORIES.map((c) => (
          <Button key={c.value} size="sm"
            variant={(current.categoria ?? "") === c.value ? "default" : "outline"}
            onClick={() => apply({ categoria: c.value })}>
            {c.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-1" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <Button key={s.value} size="sm"
            variant={(current.status ?? "") === s.value ? "default" : "outline"}
            onClick={() => apply({ status: s.value })}>
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

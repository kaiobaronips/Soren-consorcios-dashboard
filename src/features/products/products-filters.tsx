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
    <div className="enterprise-toolbar">
      <Input
        placeholder="Buscar por nome ou código..."
        className="h-8 max-w-56 rounded-none border-[#d9d9d9] bg-white"
        style={{ fontSize: "12px", lineHeight: "16px" }}
        defaultValue={current.busca ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply({ busca: e.currentTarget.value });
        }}
      />
      <div className="flex overflow-hidden rounded-none border border-[#63aef7]" role="group" aria-label="Categoria">
        {CATEGORIES.map((c) => (
          <Button key={c.value}
            className={`h-7 !rounded-none border-0 border-r border-[#63aef7] px-2 last:border-r-0 ${(current.categoria ?? "") === c.value ? "bg-[#178df4] text-white hover:bg-[#0f62fe]" : "bg-white text-[#178df4] hover:bg-[#edf5ff]"}`}
            style={{ fontSize: "12px", lineHeight: "16px" }}
            onClick={() => apply({ categoria: c.value })}>
            {c.label}
          </Button>
        ))}
      </div>
      <div className="flex overflow-hidden rounded-none border border-[#63aef7]" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <Button key={s.value}
            className={`h-7 !rounded-none border-0 border-r border-[#63aef7] px-2 last:border-r-0 ${(current.status ?? "") === s.value ? "bg-[#178df4] text-white hover:bg-[#0f62fe]" : "bg-white text-[#178df4] hover:bg-[#edf5ff]"}`}
            style={{ fontSize: "12px", lineHeight: "16px" }}
            onClick={() => apply({ status: s.value })}>
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

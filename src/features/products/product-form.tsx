"use client";

import { useActionState, useState } from "react";
import { createProduct } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: { name: string; label: string; placeholder?: string }[] = [
  { name: "productName", label: "Nome do produto", placeholder: "Imóvel XY 300 – 200m" },
  { name: "productCode", label: "Código", placeholder: "XY300" },
  { name: "administratorName", label: "Administradora" },
  { name: "creditAmount", label: "Valor da carta (ex.: 300000.00)" },
  { name: "termMonths", label: "Prazo (meses)" },
  { name: "totalAdministrationFeePercent", label: "Taxa adm total (pontos, ex.: 24.800)" },
  { name: "regularInstallmentAmount", label: "Parcela mensal (ex.: 1902.00)" },
  { name: "first12InstallmentAmount", label: "Parcela 1ª–12ª (opcional)" },
];

export function ProductForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createProduct, undefined);
  const [lastHandledState, setLastHandledState] = useState(state);

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state?.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo produto</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cadastrar produto</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input id={f.name} name={f.name} placeholder={f.placeholder} required={f.name !== "first12InstallmentAmount"} />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="category">Categoria</Label>
            <select id="category" name="category" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm">
              <option value="property">Imóvel</option>
              <option value="vehicle">Veículo</option>
              <option value="other">Outros</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="correctionIndex">Índice de correção</Label>
            <select id="correctionIndex" name="correctionIndex" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm">
              <option value="IGPM">IGP-M</option>
              <option value="IPCA">IPCA</option>
              <option value="INCC">INCC</option>
              <option value="NONE">Nenhum</option>
              <option value="CUSTOM">Personalizado</option>
            </select>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Salvar produto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

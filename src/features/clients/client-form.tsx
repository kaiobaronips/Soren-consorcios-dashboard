"use client";

import { useActionState, useState } from "react";
import { createClientAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: { name: string; label: string; placeholder?: string; required?: boolean }[] = [
  { name: "name", label: "Nome", placeholder: "Maria da Silva", required: true },
  { name: "email", label: "Email (opcional)", placeholder: "maria@exemplo.com" },
  { name: "phone", label: "Telefone (opcional)", placeholder: "(11) 91234-5678" },
  { name: "monthlyIncome", label: "Renda mensal (opcional, ex.: 5000.00)" },
  { name: "monthlyAvailableAmount", label: "Disponível mensal (opcional, ex.: 1200.00)" },
];

export function ClientForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createClientAction, undefined);
  const [lastHandledState, setLastHandledState] = useState(state);

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state?.clientId) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo cliente</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cadastrar cliente</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input id={f.name} name={f.name} placeholder={f.placeholder} required={f.required} />
            </div>
          ))}
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Salvar cliente"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

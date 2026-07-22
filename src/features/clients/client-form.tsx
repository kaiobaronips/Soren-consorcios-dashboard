"use client";

import { useActionState, useState } from "react";
import { createClientAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

const FIELDS: { name: string; label: string; placeholder?: string; required?: boolean }[] = [
  { name: "name", label: "Nome", placeholder: "Maria da Silva", required: true },
  { name: "email", label: "Email (opcional)", placeholder: "maria@exemplo.com" },
  { name: "phone", label: "Telefone (opcional)", placeholder: "(44) 9 9216-6696" },
  { name: "monthlyIncome", label: "Renda mensal (opcional)", placeholder: "3.000,00" },
  { name: "monthlyAvailableAmount", label: "Disponível mensal (opcional)", placeholder: "1.200,00" },
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatMoney(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const cents = digits.padStart(3, "0");
  const integer = cents.slice(0, -2).replace(/^0+(?=\d)/, "");
  const decimal = cents.slice(-2);
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
}

export function ClientForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createClientAction, undefined);
  const [lastHandledState, setLastHandledState] = useState(state);
  const [phone, setPhone] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [monthlyAvailableAmount, setMonthlyAvailableAmount] = useState("");

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state?.clientId) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="enterprise-button enterprise-button-primary rounded-sm px-4"><Plus aria-hidden /> Novo cliente</Button>} />
      <DialogContent className="enterprise-modal max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="enterprise-modal-header">
          <DialogTitle className="enterprise-modal-title">Cadastrar cliente</DialogTitle>
        </DialogHeader>
        <form action={action}>
          <div className="enterprise-modal-body">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.name} className={f.name === "name" ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}>
                  <Label htmlFor={f.name} className="enterprise-field-label">{f.label}</Label>
                  <Input
                    id={f.name}
                    name={f.name}
                    placeholder={f.placeholder}
                    required={f.required}
                    className="enterprise-field-input"
                    inputMode={f.name === "phone" || f.name.startsWith("monthly") ? "numeric" : undefined}
                    value={f.name === "phone" ? phone : f.name === "monthlyIncome" ? monthlyIncome : f.name === "monthlyAvailableAmount" ? monthlyAvailableAmount : undefined}
                    onChange={(event) => {
                      if (f.name === "phone") setPhone(formatPhone(event.currentTarget.value));
                      if (f.name === "monthlyIncome") setMonthlyIncome(formatMoney(event.currentTarget.value));
                      if (f.name === "monthlyAvailableAmount") setMonthlyAvailableAmount(formatMoney(event.currentTarget.value));
                    }}
                  />
                </div>
              ))}
            </div>
            {state?.error && (
              <p role="alert" className="mt-4 border border-[#da1e28] bg-[#fff1f1] px-3 py-2 text-sm text-[#da1e28]">
                {state.error}
              </p>
            )}
          </div>
          <div className="enterprise-modal-footer">
            <DialogClose render={<Button type="button" className="enterprise-button enterprise-button-secondary rounded-sm px-4" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" className="enterprise-button enterprise-modal-submit rounded-sm px-4" disabled={pending}>
              {pending ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

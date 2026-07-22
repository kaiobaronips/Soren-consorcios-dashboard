"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/repositories/clients";
import { deleteClientAction, updateClientAction } from "./actions";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatMoney(value: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const cents = digits.padStart(3, "0");
  const integer = cents.slice(0, -2).replace(/^0+(?=\d)/, "");
  const decimal = cents.slice(-2);
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
}

export function ClientAdminActions({ client }: { client: Client }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateClientAction, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteClientAction, undefined);
  const [phone, setPhone] = useState(formatPhone(client.phone ?? ""));
  const [monthlyIncome, setMonthlyIncome] = useState(formatMoney(client.monthlyIncome));
  const [monthlyAvailableAmount, setMonthlyAvailableAmount] = useState(formatMoney(client.monthlyAvailableAmount));

  if (editState?.success && editOpen) setEditOpen(false);
  if (deleteState?.success && deleteOpen) setDeleteOpen(false);

  return (
    <div className="flex items-center gap-1">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger render={<Button type="button" variant="outline" size="icon-sm" className="rounded-sm border-[#c6c6c6] bg-white" aria-label="Editar cliente" />}>
          <Pencil aria-hidden className="size-3.5" />
        </DialogTrigger>
        <DialogContent className="enterprise-modal max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="enterprise-modal-header">
            <DialogTitle className="enterprise-modal-title">Editar cliente</DialogTitle>
          </DialogHeader>
          <form action={editAction}>
            <input type="hidden" name="id" value={client.id} />
            <div className="enterprise-modal-body">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor={`name-${client.id}`} className="enterprise-field-label">Nome</Label>
                  <Input id={`name-${client.id}`} name="name" defaultValue={client.name} className="enterprise-field-input" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`email-${client.id}`} className="enterprise-field-label">E-mail</Label>
                  <Input id={`email-${client.id}`} name="email" type="email" defaultValue={client.email ?? ""} className="enterprise-field-input" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`phone-${client.id}`} className="enterprise-field-label">Telefone</Label>
                  <Input id={`phone-${client.id}`} name="phone" value={phone} onChange={(event) => setPhone(formatPhone(event.currentTarget.value))} className="enterprise-field-input" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`income-${client.id}`} className="enterprise-field-label">Renda mensal</Label>
                  <Input id={`income-${client.id}`} name="monthlyIncome" value={monthlyIncome} onChange={(event) => setMonthlyIncome(formatMoney(event.currentTarget.value))} className="enterprise-field-input" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`available-${client.id}`} className="enterprise-field-label">Disponível mensal</Label>
                  <Input id={`available-${client.id}`} name="monthlyAvailableAmount" value={monthlyAvailableAmount} onChange={(event) => setMonthlyAvailableAmount(formatMoney(event.currentTarget.value))} className="enterprise-field-input" inputMode="numeric" />
                </div>
              </div>
              {editState?.error && <p role="alert" className="mt-4 border border-[#da1e28] bg-[#fff1f1] px-3 py-2 text-sm text-[#da1e28]">{editState.error}</p>}
            </div>
            <div className="enterprise-modal-footer">
              <DialogClose render={<Button type="button" className="enterprise-button enterprise-button-secondary rounded-sm px-4" />}>Cancelar</DialogClose>
              <Button type="submit" className="enterprise-button enterprise-modal-submit rounded-sm px-4" disabled={editPending}>
                {editPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger render={<Button type="button" variant="outline" size="icon-sm" className="rounded-sm border-[#c6c6c6] bg-white text-[#da1e28]" aria-label="Excluir cliente" />}>
          <Trash2 aria-hidden className="size-3.5" />
        </DialogTrigger>
        <DialogContent className="enterprise-modal p-0 sm:max-w-md">
          <DialogHeader className="enterprise-modal-header">
            <DialogTitle className="enterprise-modal-title">Excluir cliente</DialogTitle>
          </DialogHeader>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={client.id} />
            <div className="enterprise-modal-body">
              <p className="text-sm text-[#525252]">Remover <span className="font-medium text-[#161616]">{client.name}</span> da lista de clientes?</p>
              {deleteState?.error && <p role="alert" className="mt-4 border border-[#da1e28] bg-[#fff1f1] px-3 py-2 text-sm text-[#da1e28]">{deleteState.error}</p>}
            </div>
            <div className="enterprise-modal-footer">
              <DialogClose render={<Button type="button" className="enterprise-button enterprise-button-secondary rounded-sm px-4" />}>Cancelar</DialogClose>
              <Button type="submit" className="enterprise-button rounded-sm border-[#da1e28] bg-[#da1e28] px-4 text-white hover:bg-[#b81922]" disabled={deletePending}>
                {deletePending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

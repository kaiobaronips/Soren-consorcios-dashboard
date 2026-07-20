"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { searchClientsAction } from "@/features/clients/actions";
import type { Client } from "@/repositories/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { ProjectedRates } from "@/domain/financial-calculations";
import type { FinancialIndex } from "@/repositories/indexes";
import { atender } from "./actions";
import { SummaryHeader } from "./summary-header";
import { ResultCards } from "./result-cards";

const CATEGORIES = [
  { value: "all", label: "Todas" },
  { value: "property", label: "Imóvel" },
  { value: "vehicle", label: "Veículo" },
];

const TERMS = [
  { value: "", label: "Livre" },
  { value: "48", label: "48 meses" },
  { value: "60", label: "60 meses" },
  { value: "200", label: "200 meses" },
  { value: "220", label: "220 meses" },
  { value: "240", label: "240 meses" },
];

export function AtendimentoForm({
  indexes,
  projectedRates,
  canEditRate,
}: {
  indexes: Record<string, FinancialIndex>;
  projectedRates: ProjectedRates;
  canEditRate: boolean;
}) {
  const [state, action, pending] = useActionState(atender, undefined);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [income, setIncome] = useState("");
  const [available, setAvailable] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchClientsAction(query).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  const visibleResults = !selected && query.trim().length >= 2 ? results : [];

  function selectClient(client: Client) {
    setSelected(client);
    setQuery(client.name);
    setShowDropdown(false);
    setIncome(client.monthlyIncome ?? "");
    setAvailable(client.monthlyAvailableAmount ?? "");
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setIncome("");
    setAvailable("");
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5 rounded-xl border bg-card p-5 shadow-xs sm:p-6">
        <div className="space-y-1.5">
          <Label htmlFor="clientName">Cliente</Label>
          <div className="relative">
            <Input
              id="clientName"
              name="clientName"
              placeholder="Buscar cliente existente ou digitar nome novo..."
              autoComplete="off"
              value={query}
              disabled={!!selected}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />
            {selected && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={clearSelection}
              >
                Trocar
              </Button>
            )}
            {showDropdown && !selected && query.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover py-1 shadow-lg">
                {visibleResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => selectClient(c)}
                  >
                    {c.name}
                    {c.email && <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>}
                  </button>
                ))}
                {query.trim().length >= 2 && (
                  <button
                    type="button"
                    className="block w-full border-t px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setShowDropdown(false)}
                  >
                    Criar novo cliente “{query}”
                  </button>
                )}
              </div>
            )}
          </div>
          <input type="hidden" name="clientId" value={selected?.id ?? ""} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="monthlyIncome">Renda mensal (opcional)</Label>
            <Input
              id="monthlyIncome"
              name="monthlyIncome"
              placeholder="5000.00"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthlyAvailableAmount">Valor disponível mensal</Label>
            <Input
              id="monthlyAvailableAmount"
              name="monthlyAvailableAmount"
              placeholder="1500.00"
              required
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="desiredCategory">Categoria</Label>
            <NativeSelect
              id="desiredCategory"
              name="desiredCategory"
              defaultValue="all"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desiredTermMonths">Prazo desejado</Label>
            <NativeSelect
              id="desiredTermMonths"
              name="desiredTermMonths"
              defaultValue=""
            >
              {TERMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {state?.error && (
          <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Calculando..." : "Consultar planos elegíveis"}
        </Button>
      </form>

      {state?.result && state?.client && (
        <div className="space-y-4">
          <SummaryHeader result={state.result} client={state.client} />
          <ResultCards
            ranked={state.result.ranked}
            highlights={state.result.highlights}
            basis={state.result.basis}
            catalogMinInstallment={state.catalogMinInstallment}
            clientId={state.client.id}
            monthlyAvailableAmount={state.client.monthlyAvailableAmount}
            monthlyIncome={state.client.monthlyIncome}
            indexes={indexes}
            projectedRates={projectedRates}
            canEditRate={canEditRate}
          />
        </div>
      )}
    </div>
  );
}

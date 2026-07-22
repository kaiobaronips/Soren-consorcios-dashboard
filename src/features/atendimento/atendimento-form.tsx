"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { searchClientsAction } from "@/features/clients/actions";
import type { Client } from "@/repositories/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectedRates } from "@/domain/financial-calculations";
import type { FinancialIndex } from "@/repositories/indexes";
import { cn } from "@/lib/utils";
import { atender } from "./actions";
import { SummaryHeader } from "./summary-header";
import { ResultCards } from "./result-cards";
import {
  SimulationPanel,
  type SimulationPanelProduct,
} from "@/features/simulations/simulation-panel";

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

function formatMoney(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const cents = digits.padStart(3, "0");
  const integer = cents.slice(0, -2).replace(/^0+(?=\d)/, "");
  const decimal = cents.slice(-2);
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
}

function EnterpriseSelect({
  id,
  name,
  value,
  options,
  onValueChange,
}: {
  id: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="enterprise-select">
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        type="button"
        className="enterprise-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <span>{selected.label}</span>
        <ChevronDown className="enterprise-select-chevron" aria-hidden />
      </button>
      {open && (
        <div className="enterprise-select-menu" role="listbox" aria-labelledby={id} tabIndex={-1}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="enterprise-select-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AtendimentoForm({
  indexes,
  projectedRates,
  canEditRate,
  presentation = "page",
}: {
  indexes: Record<string, FinancialIndex>;
  projectedRates: ProjectedRates;
  canEditRate: boolean;
  presentation?: "page" | "side-panel";
}) {
  const [state, action, pending] = useActionState(atender, undefined);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [income, setIncome] = useState("");
  const [available, setAvailable] = useState("");
  const [desiredCategory, setDesiredCategory] = useState("all");
  const [desiredTermMonths, setDesiredTermMonths] = useState("");
  const [simulationProduct, setSimulationProduct] = useState<SimulationPanelProduct | null>(null);
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
  const inputClassName = presentation === "side-panel" ? "enterprise-field-input" : undefined;

  function selectClient(client: Client) {
    setSelected(client);
    setQuery(client.name);
    setShowDropdown(false);
    setIncome(formatMoney(client.monthlyIncome ?? ""));
    setAvailable(formatMoney(client.monthlyAvailableAmount ?? ""));
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setIncome("");
    setAvailable("");
  }

  function submitAtendimento(formData: FormData) {
    setSimulationProduct(null);
    action(formData);
  }

  const fields = (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="clientName">Cliente</Label>
        <div className="relative">
          <Input
            id="clientName"
            name="clientName"
            placeholder="Buscar cliente / Digitar nome"
            autoComplete="off"
            value={query}
            disabled={!!selected}
            className={cn(inputClassName, presentation === "side-panel" && "enterprise-client-search-input")}
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
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-sm border border-[#c6c6c6] bg-white py-1 shadow-none">
              {visibleResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => selectClient(c)}
                >
                  {c.name}
                </button>
              ))}
              {visibleResults.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-[#6f6f6f]">
                  Nenhum cliente encontrado.
                </p>
              )}
            </div>
          )}
        </div>
        <input type="hidden" name="clientId" value={selected?.id ?? ""} />
      </div>

      <div className={cn("grid grid-cols-1 gap-4", presentation === "page" && "sm:grid-cols-2")}>
        <div className="space-y-1.5">
          <Label htmlFor="monthlyIncome">Renda mensal (opcional)</Label>
          <Input
            id="monthlyIncome"
            name="monthlyIncome"
            placeholder="3.000,00"
            value={income}
            className={inputClassName}
            inputMode="numeric"
            onChange={(e) => setIncome(formatMoney(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="monthlyAvailableAmount">Valor disponível mensal</Label>
          <Input
            id="monthlyAvailableAmount"
            name="monthlyAvailableAmount"
            placeholder="1.500,00"
            required
            value={available}
            className={inputClassName}
            inputMode="numeric"
            onChange={(e) => setAvailable(formatMoney(e.target.value))}
          />
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4", presentation === "page" && "sm:grid-cols-2")}>
        <div className="space-y-1.5">
          <Label htmlFor="desiredCategory">Categoria</Label>
          <EnterpriseSelect
            id="desiredCategory"
            name="desiredCategory"
            value={desiredCategory}
            options={CATEGORIES}
            onValueChange={setDesiredCategory}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desiredTermMonths">Prazo desejado</Label>
          <EnterpriseSelect
            id="desiredTermMonths"
            name="desiredTermMonths"
            value={desiredTermMonths}
            options={TERMS}
            onValueChange={setDesiredTermMonths}
          />
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-sm border border-[#da1e28] bg-[#fff1f1] px-3 py-2 text-sm text-[#da1e28]">
          {state.error}
        </p>
      )}
    </>
  );

  const resultsContent = state?.result && state?.client && simulationProduct ? (
    <SimulationPanel
      key={simulationProduct.id}
      product={simulationProduct}
      clientId={state.client.id}
      monthlyAvailableAmount={state.client.monthlyAvailableAmount}
      monthlyIncome={state.client.monthlyIncome}
      indexes={indexes}
      projectedRates={projectedRates}
      canEditRate={canEditRate}
      onBack={() => setSimulationProduct(null)}
    />
  ) : state?.result && state?.client ? (
    <div className="space-y-4">
      <SummaryHeader result={state.result} client={state.client} />
      <ResultCards
        ranked={state.result.ranked}
        catalogMinInstallment={state.catalogMinInstallment}
        onSimulate={setSimulationProduct}
      />
    </div>
  ) : null;

  if (presentation === "side-panel") {
    return (
      <div className="enterprise-atendimento-layout">
        <aside className="enterprise-atendimento-panel" aria-label="Formulário de atendimento">
          <form action={submitAtendimento} className="enterprise-form flex min-h-full flex-col">
            <div className="enterprise-atendimento-panel-body space-y-5">
              {fields}
            </div>

            <footer className="enterprise-atendimento-panel-footer">
              <Button
                type="submit"
                disabled={pending}
                className="enterprise-button enterprise-button-primary enterprise-atendimento-submit w-full rounded-sm px-4"
              >
                {pending ? "Calculando..." : "Consultar planos elegíveis"}
              </Button>
            </footer>
          </form>
        </aside>

        <section className="enterprise-atendimento-results flex min-w-0 flex-1 flex-col p-6 lg:p-8">
          {resultsContent ?? (
            <div className="flex min-h-0 flex-1 select-none flex-col">
              <div className="enterprise-card relative overflow-hidden px-5 py-4">
                <h2 className="text-sm font-semibold leading-5 text-[#161616]">
                  Nenhuma consulta executada
                </h2>
                <p className="mt-1.5 text-sm leading-5 text-[#6f6f6f]">
                  Preencha os dados no painel lateral para calcular a elegibilidade dos produtos disponíveis.
                </p>
                <div className="absolute inset-x-0 bottom-0 h-px bg-[color:var(--enterprise-border)]" />
              </div>

              <div
                className="flex flex-1 flex-col items-center justify-center text-center"
                aria-hidden
              >
                <h2 className="text-3xl font-normal tracking-tight text-[color:var(--enterprise-text-muted)] lg:text-4xl">
                  Atendimento
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-[color:var(--enterprise-text-muted)]">
                  Consulte planos elegíveis e acompanhe o resultado da simulação
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={submitAtendimento} className="enterprise-form enterprise-card space-y-5 overflow-visible p-5 sm:p-6">
        <div className="border-b border-[#e0e0e0] pb-4">
          <h2 className="text-base font-medium text-[#161616]">Dados do atendimento</h2>
          <p className="mt-1 text-sm text-[#525252]">Selecione um cliente existente ou inicie um novo cadastro.</p>
        </div>
        {fields}
        <Button type="submit" disabled={pending} className="enterprise-button enterprise-button-primary rounded-sm px-4">
          {pending ? "Calculando..." : "Consultar planos elegíveis"}
        </Button>
      </form>

      {resultsContent}
    </div>
  );
}

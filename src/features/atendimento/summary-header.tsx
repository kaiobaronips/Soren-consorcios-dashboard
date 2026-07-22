import { LiveBar } from "@/components/ui/live-bar";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AtendimentoResult } from "@/services/atendimento";
import type { AtenderClient } from "./actions";

function Stat({
  label,
  value,
  hero = false,
  children,
}: {
  label: string;
  value: string;
  hero?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-r border-[color:var(--enterprise-border)] bg-[color:var(--enterprise-surface)] p-4">
      <p className="text-xs font-medium leading-4 text-[color:var(--enterprise-text-secondary)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-xl font-normal leading-7 text-[color:var(--enterprise-text)] tabular-nums",
          hero && "text-2xl text-[color:var(--enterprise-blue)]",
        )}
      >
        {value}
      </p>
      {children}
    </div>
  );
}

export function SummaryHeader({ result, client }: { result: AtendimentoResult; client: AtenderClient }) {
  const { summary } = result;
  const commitment = result.incomeCommitmentPercent
    ? Number(result.incomeCommitmentPercent)
    : null;

  return (
    <section className="enterprise-card overflow-hidden" data-slot="card" aria-labelledby="atendimento-client-name">
      <header className="enterprise-card-header items-start border-[#393939] bg-[#161616]">
        <div className="min-w-0">
          <h2 id="atendimento-client-name" className="text-lg font-normal leading-6 text-white">
            {client.name}
          </h2>
          <p className="mt-1 text-sm leading-5 text-white">
            Renda mensal: {client.monthlyIncome ? formatCurrency(client.monthlyIncome) : "não informada"}
          </p>
        </div>
        <span className="enterprise-status enterprise-status-neutral shrink-0">
          Regra: {result.basisLabel}
        </span>
      </header>

      <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
        <Stat label="Disponível mensal" value={formatCurrency(client.monthlyAvailableAmount)} />
        <Stat
          label="Comprometimento da renda"
          value={result.incomeCommitmentPercent ? formatPercent(result.incomeCommitmentPercent) : "—"}
        >
          {commitment !== null && (
            <LiveBar
              percent={commitment}
              alert={Boolean(result.riskAlert)}
              className="mt-2 rounded-none bg-[color:var(--enterprise-border)] [&>div]:rounded-none"
            />
          )}
        </Stat>
        <Stat label="Planos elegíveis" value={String(summary.eligibleCount)} />
        <Stat
          hero
          label="Maior carta pagável"
          value={summary.maxPayableCredit ? formatCurrency(summary.maxPayableCredit) : "—"}
        />
        <Stat
          label="Menor parcela"
          value={summary.minInstallment ? formatCurrency(summary.minInstallment) : "—"}
        />
        <Stat
          label="Maior parcela compatível"
          value={summary.maxCompatibleInstallment ? formatCurrency(summary.maxCompatibleInstallment) : "—"}
        />
        <Stat label="Melhor folga mensal" value={summary.bestSlack ? formatCurrency(summary.bestSlack) : "—"} />
      </div>
    </section>
  );
}

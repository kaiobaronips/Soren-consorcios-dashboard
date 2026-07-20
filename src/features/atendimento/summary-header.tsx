import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          hero && "font-heading text-2xl text-primary",
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
    <Card className="animate-fade-up">
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-2xl font-semibold">{client.name}</h2>
            <p className="text-sm text-muted-foreground">
              Renda mensal: {client.monthlyIncome ? formatCurrency(client.monthlyIncome) : "não informada"}
            </p>
          </div>
          <Badge variant="secondary">Regra: {result.basisLabel}</Badge>
        </div>

        {result.riskAlert && (
          <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm font-medium text-warning-foreground">
            {result.riskAlert}
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Disponível mensal" value={formatCurrency(client.monthlyAvailableAmount)} />
          <Stat
            label="Comprometimento da renda"
            value={result.incomeCommitmentPercent ? formatPercent(result.incomeCommitmentPercent) : "—"}
          >
            {commitment !== null && (
              <LiveBar
                percent={commitment}
                alert={Boolean(result.riskAlert)}
                className="mt-2"
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
      </CardContent>
    </Card>
  );
}

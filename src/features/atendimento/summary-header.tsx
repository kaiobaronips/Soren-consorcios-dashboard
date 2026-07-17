import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { AtendimentoResult } from "@/services/atendimento";
import type { AtenderClient } from "./actions";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export function SummaryHeader({ result, client }: { result: AtendimentoResult; client: AtenderClient }) {
  const { summary } = result;
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{client.name}</h2>
            <p className="text-sm text-muted-foreground">
              Renda mensal: {client.monthlyIncome ? formatCurrency(client.monthlyIncome) : "não informada"}
            </p>
          </div>
          <Badge variant="secondary">Regra: {result.basisLabel}</Badge>
        </div>

        {result.riskAlert && (
          <p className="rounded-md border border-yellow-600/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
            {result.riskAlert}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Disponível mensal" value={formatCurrency(client.monthlyAvailableAmount)} />
          <Stat
            label="Comprometimento da renda"
            value={result.incomeCommitmentPercent ? formatPercent(result.incomeCommitmentPercent) : "—"}
          />
          <Stat label="Planos elegíveis" value={String(summary.eligibleCount)} />
          <Stat
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

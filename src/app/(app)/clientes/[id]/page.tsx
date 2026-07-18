import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getClient } from "@/repositories/clients";
import { listSimulationsByClient } from "@/repositories/simulations";
import { listProfileNames } from "@/repositories/profiles";
import { formatCurrency, formatDate } from "@/lib/format";
import { SimulationsHistory } from "@/features/simulations/simulations-history";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [simulations, consultantNames] = await Promise.all([
    listSimulationsByClient(id),
    listProfileNames(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {client.name}
            {client.status !== "active" && <Badge variant="secondary">{client.status}</Badge>}
          </h1>
          <p className="text-muted-foreground">
            Consultor: {consultantNames[client.consultantId] ?? "—"} · Cadastro em {formatDate(client.createdAt)}
          </p>
        </div>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/clientes" />}>
          Voltar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Dados de contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">E-mail:</span> {client.email ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Telefone:</span> {client.phone ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Resumo financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Renda mensal:</span>{" "}
              {client.monthlyIncome ? formatCurrency(client.monthlyIncome) : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Disponível mensal:</span>{" "}
              {client.monthlyAvailableAmount ? formatCurrency(client.monthlyAvailableAmount) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Histórico de simulações</h2>
        <SimulationsHistory simulations={simulations} />
      </div>

      <p className="text-xs text-muted-foreground">
        CRM completo (timeline de interações, documentos, tarefas) chega na Fase 5. Esta é a versão mínima da
        página do cliente.
      </p>
    </div>
  );
}

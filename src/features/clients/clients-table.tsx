import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Client } from "@/repositories/clients";

export function ClientsTable({
  clients,
  consultantNames,
}: {
  clients: Client[];
  consultantNames: Record<string, string>;
}) {
  if (clients.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Nenhum cliente cadastrado ainda.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead className="text-right">Renda mensal</TableHead>
            <TableHead className="text-right">Disponível mensal</TableHead>
            <TableHead>Consultor</TableHead>
            <TableHead>Cadastro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                {c.status !== "active" && <Badge variant="secondary" className="ml-2">{c.status}</Badge>}
              </TableCell>
              <TableCell>
                <div>{c.email ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{c.phone ?? "—"}</div>
              </TableCell>
              <TableCell className="text-right">
                {c.monthlyIncome ? formatCurrency(c.monthlyIncome) : "—"}
              </TableCell>
              <TableCell className="text-right">
                {c.monthlyAvailableAmount ? formatCurrency(c.monthlyAvailableAmount) : "—"}
              </TableCell>
              <TableCell>{consultantNames[c.consultantId] ?? "—"}</TableCell>
              <TableCell>{formatDate(c.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

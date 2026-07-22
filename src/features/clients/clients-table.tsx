import Link from "next/link";
import { StatusBadge } from "@/components/operational/enterprise-ui";
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
    return <section className="enterprise-card py-12 text-center text-sm text-[#6f6f6f]">Nenhum cliente cadastrado ainda.</section>;
  }
  return (
    <section className="enterprise-card overflow-hidden">
      <header className="enterprise-card-header">
        <h2 className="enterprise-card-title">Lista de clientes</h2>
        <span className="text-xs text-[#6f6f6f]">{clients.length} registro(s)</span>
      </header>
      <div className="overflow-x-auto">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th className="text-right">Renda mensal</th>
              <th className="text-right">Disponível mensal</th>
              <th>Consultor</th>
              <th>Cadastro</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/clientes/${c.id}`} className="font-medium transition-colors hover:text-primary hover:underline">
                  {c.name}
                </Link>
              </td>
              <td>
                <div>{c.email ?? "—"}</div>
                <div className="text-xs text-[#6f6f6f]">{c.phone ?? "—"}</div>
              </td>
              <td className="text-right tabular-nums">
                {c.monthlyIncome ? formatCurrency(c.monthlyIncome) : "—"}
              </td>
              <td className="text-right tabular-nums">
                {c.monthlyAvailableAmount ? formatCurrency(c.monthlyAvailableAmount) : "—"}
              </td>
              <td>{consultantNames[c.consultantId] ?? "—"}</td>
              <td>{formatDate(c.createdAt)}</td>
              <td><StatusBadge status={c.status === "active" ? "Ativo" : "Inativo"} /></td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

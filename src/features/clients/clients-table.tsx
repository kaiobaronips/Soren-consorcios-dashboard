import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Client } from "@/repositories/clients";
import { ClientAdminActions } from "./client-admin-actions";

export function ClientsTable({
  clients,
  consultantNames,
  canManage,
}: {
  clients: Client[];
  consultantNames: Record<string, string>;
  canManage: boolean;
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
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Renda mensal</th>
              <th>Disponível mensal</th>
              <th>Consultor</th>
              <th>Cadastro</th>
              {canManage && <th>Ação</th>}
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
              <td>{c.phone ?? "—"}</td>
              <td>{c.email ?? "—"}</td>
              <td className="tabular-nums">
                {c.monthlyIncome ? formatCurrency(c.monthlyIncome) : "—"}
              </td>
              <td className="tabular-nums">
                {c.monthlyAvailableAmount ? formatCurrency(c.monthlyAvailableAmount) : "—"}
              </td>
              <td>{consultantNames[c.consultantId] ?? "—"}</td>
              <td>{formatDate(c.createdAt)}</td>
              {canManage && <td><ClientAdminActions client={c} /></td>}
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { listClients } from "@/repositories/clients";
import { listProfileNames } from "@/repositories/profiles";
import { OperationalPageHeader } from "@/components/operational/enterprise-ui";
import { ClientsTable } from "@/features/clients/clients-table";
import { ClientForm } from "@/features/clients/client-form";

export default async function ClientesPage() {
  const [clients, consultantNames] = await Promise.all([listClients(), listProfileNames()]);
  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Clientes"
        actions={<ClientForm />}
      />
      <ClientsTable clients={clients} consultantNames={consultantNames} />
    </div>
  );
}

import { listClients } from "@/repositories/clients";
import { getCurrentProfile, listProfileNames } from "@/repositories/profiles";
import { OperationalPageHeader } from "@/components/operational/enterprise-ui";
import { ClientsTable } from "@/features/clients/clients-table";
import { ClientForm } from "@/features/clients/client-form";

export default async function ClientesPage() {
  const [clients, consultantNames, profile] = await Promise.all([listClients(), listProfileNames(), getCurrentProfile()]);
  const canManage = profile.role === "admin";
  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Clientes"
        actions={<ClientForm />}
      />
      <ClientsTable clients={clients} consultantNames={consultantNames} canManage={canManage} />
    </div>
  );
}

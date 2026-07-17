import { listClients } from "@/repositories/clients";
import { listProfileNames } from "@/repositories/profiles";
import { ClientsTable } from "@/features/clients/clients-table";
import { ClientForm } from "@/features/clients/client-form";

export default async function ClientesPage() {
  const [clients, consultantNames] = await Promise.all([listClients(), listProfileNames()]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-muted-foreground">{clients.length} cliente(s)</p>
        </div>
        <ClientForm />
      </div>
      <ClientsTable clients={clients} consultantNames={consultantNames} />
      <p className="text-xs text-muted-foreground">
        CRM completo (filtros avançados, timeline de interações, página individual do cliente) chega na Fase 5.
      </p>
    </div>
  );
}

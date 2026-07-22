import { AtendimentoForm } from "@/features/atendimento/atendimento-form";
import { getCurrentProfile } from "@/repositories/profiles";
import { getLatestIndexes } from "@/repositories/indexes";
import { getOrgSettings } from "@/repositories/settings";
import { OperationalPageHeader } from "@/components/operational/enterprise-ui";

export default async function AtendimentoPage() {
  const [profile, indexes, settings] = await Promise.all([
    getCurrentProfile(),
    getLatestIndexes(),
    getOrgSettings(),
  ]);
  const canEditRate = profile.role === "admin" || profile.role === "manager";

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Novo atendimento"
        description="Informe o perfil financeiro do cliente para consultar os planos elegíveis."
      />
      <AtendimentoForm
        indexes={indexes}
        projectedRates={settings.projectedAnnualRates}
        canEditRate={canEditRate}
      />
    </div>
  );
}

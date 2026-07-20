import { AtendimentoForm } from "@/features/atendimento/atendimento-form";
import { IndicesWidgets } from "@/features/atendimento/indices-widgets";
import { getCurrentProfile } from "@/repositories/profiles";
import { getLatestIndexes } from "@/repositories/indexes";
import { getOrgSettings } from "@/repositories/settings";

export default async function AtendimentoPage() {
  const [profile, indexes, settings] = await Promise.all([
    getCurrentProfile(),
    getLatestIndexes(),
    getOrgSettings(),
  ]);
  const canEditRate = profile.role === "admin" || profile.role === "manager";

  return (
    <div className="space-y-6">
      <IndicesWidgets indexes={indexes} />
      <AtendimentoForm
        indexes={indexes}
        projectedRates={settings.projectedAnnualRates}
        canEditRate={canEditRate}
      />
    </div>
  );
}

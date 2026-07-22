import { AtendimentoForm } from "@/features/atendimento/atendimento-form";
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
    <AtendimentoForm
      indexes={indexes}
      projectedRates={settings.projectedAnnualRates}
      canEditRate={canEditRate}
      presentation="side-panel"
    />
  );
}

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Novo atendimento</h1>
        <p className="text-muted-foreground">
          Informe o cliente e o valor disponível para ver os planos elegíveis, ranqueados por compatibilidade.
        </p>
      </div>
      <AtendimentoForm
        indexes={indexes}
        projectedRates={settings.projectedAnnualRates}
        canEditRate={canEditRate}
      />
    </div>
  );
}

import { AtendimentoForm } from "@/features/atendimento/atendimento-form";

export default function AtendimentoPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Novo atendimento</h1>
        <p className="text-muted-foreground">
          Informe o cliente e o valor disponível para ver os planos elegíveis, ranqueados por compatibilidade.
        </p>
      </div>
      <AtendimentoForm />
    </div>
  );
}

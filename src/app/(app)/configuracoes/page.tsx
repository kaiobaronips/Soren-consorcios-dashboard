import { Settings2 } from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Settings2 aria-hidden className="size-5" />
        </div>
        <p className="font-medium">Em breve</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          A edição das configurações da organização será liberada em uma próxima
          versão. Hoje os valores vigentes já são aplicados automaticamente no
          atendimento.
        </p>
      </div>
    </div>
  );
}

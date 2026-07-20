import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Soren Consórcios</h1>
        <p className="mt-2 text-muted-foreground">
          Sistema de atendimento: informe o valor disponível do cliente e veja os planos
          compatíveis, simule reajustes e compare com investimentos.
        </p>
      </div>
      <Button render={<Link href="/atendimento">Iniciar novo atendimento</Link>} />
    </div>
  );
}

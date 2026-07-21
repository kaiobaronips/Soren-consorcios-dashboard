import Link from "next/link";

import { Button } from "@/components/ui/button";
import { IndicesWidgets } from "@/features/atendimento/indices-widgets";
import { getLatestIndexes } from "@/repositories/indexes";

export default async function HomePage() {
  const indexes = await getLatestIndexes();
  return (
    <div className="space-y-10">
      <section className="max-w-2xl animate-fade-up space-y-5 pt-6">
        <h1 className="font-heading text-4xl leading-tight font-semibold text-balance sm:text-5xl sm:leading-tight">
          Atendimento de consórcio, do valor disponível à simulação.
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Informe o valor disponível do cliente e veja os planos compatíveis,
          simule reajustes e compare com investimentos.
        </p>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/atendimento">Iniciar novo atendimento</Link>}
        />
      </section>

      <IndicesWidgets indexes={indexes} />
    </div>
  );
}

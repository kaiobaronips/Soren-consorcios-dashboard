import { ClipboardList, LineChart, Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Search,
    title: "Informe o valor disponível",
    description:
      "Busque o cliente ou cadastre na hora, com renda e valor mensal disponível.",
  },
  {
    icon: ClipboardList,
    title: "Veja planos elegíveis ranqueados",
    description:
      "O sistema classifica, explica o porquê de cada score e destaca os melhores planos.",
  },
  {
    icon: LineChart,
    title: "Simule e salve",
    description:
      "Reajustes IGP-M/IPCA, cenários e comparação com CDI — com snapshot imutável.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-12">
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

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="animate-fade-up rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            style={{ animationDelay: `${150 + index * 100}ms` }}
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <step.icon aria-hidden className="size-4.5" />
            </div>
            <h2 className="mt-4 text-sm font-semibold">{step.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

import { LoginForm } from "@/features/auth/login-form";

const BARS = [34, 52, 41, 66, 58, 80, 72, 95] as const;

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Painel institucional (grafite, como a sidebar) */}
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex xl:w-[55%]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary font-heading text-lg font-semibold text-sidebar-primary-foreground">
            S
          </div>
          <p className="font-heading text-lg font-semibold">Soren Consórcios</p>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="font-heading text-4xl leading-tight font-semibold text-balance xl:text-5xl xl:leading-tight">
              A simulação certa fecha o consórcio certo.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-sidebar-foreground/70">
              Planos elegíveis ranqueados, reajustes IGP-M/IPCA e comparação
              com investimentos — tudo na hora do atendimento.
            </p>
          </div>

          {/* Barras vivas: eco discreto do simulador */}
          <div
            aria-hidden
            className="flex h-20 items-end gap-2"
          >
            {BARS.map((height, index) => (
              <div
                key={index}
                className="w-3 animate-fade-up rounded-sm bg-sidebar-primary/80"
                style={{
                  height: `${height}%`,
                  animationDelay: `${index * 90}ms`,
                }}
              />
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          Soren Consórcios · Sistema comercial de atendimento
        </p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <LoginForm />
      </div>
    </main>
  );
}

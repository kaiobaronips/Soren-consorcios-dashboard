import Image from "next/image";
import { LoginForm } from "@/features/auth/login-form";

/* ─── Fundo animado: grid scanlines + orbs pulsantes (padrão ERP) ─── */
function BackgroundOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Grid scanlines */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklch, var(--primary) 60%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--primary) 60%, transparent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Orb superior direito */}
      <div
        className="absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full opacity-10"
        style={{
          background:
            "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          animation: "soren-pulse-orb 8s ease-in-out infinite",
        }}
      />
      {/* Orb inferior esquerdo (violeta do chart-4) */}
      <div
        className="absolute -bottom-48 -left-48 h-[700px] w-[700px] rounded-full opacity-[0.06]"
        style={{
          background:
            "radial-gradient(circle, var(--chart-4) 0%, transparent 70%)",
          animation: "soren-pulse-orb 12s ease-in-out infinite reverse",
        }}
      />
      {/* Orb centro-direita sutil */}
      <div
        className="absolute top-1/2 right-1/4 h-[300px] w-[300px] -translate-y-1/2 rounded-full opacity-[0.04]"
        style={{
          background:
            "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          animation: "soren-pulse-orb 6s ease-in-out infinite 2s",
        }}
      />
    </div>
  );
}

/* ─── Badge flutuante de destaque ─── */
function StatBadge({
  label,
  value,
  delay = "0s",
}: {
  label: string;
  value: string;
  delay?: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 backdrop-blur-sm"
      style={{ animation: `soren-float 4s ease-in-out infinite ${delay}` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-primary"
        style={{ boxShadow: "0 0 6px var(--primary)" }}
      />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-sm font-semibold text-primary">{value}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    // Escopo .dark: a tela de login é sempre grafite imersiva (referência dark-only),
    // independente do tema claro/escuro do app.
    <main className="dark relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundOrbs />

      {/* Layout: split em md+, empilhado no mobile */}
      <div className="relative z-10 flex min-h-screen flex-col md:flex-row">
        {/* ── PAINEL ESQUERDO — marca (oculto no mobile) ── */}
        <div className="hidden flex-col justify-between p-10 md:flex md:w-1/2 lg:p-16">
          <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <Image
              src="/soren-logo.png"
              alt="Soren"
              width={925}
              height={241}
              priority
              className="h-8 w-auto"
            />
          </div>

          <div className="space-y-6">
            <div
              className="animate-fade-up space-y-3"
              style={{ animationDelay: "0.2s" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Plataforma Comercial
              </p>
              <h1 className="font-heading text-4xl font-normal leading-[1.1] tracking-tight text-card-foreground lg:text-5xl">
                A simulação certa
                <br />
                fecha o <span className="text-primary">consórcio certo</span>.
              </h1>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Planos elegíveis ranqueados, reajustes IGP-M/IPCA e comparação
                com investimentos — tudo na hora do atendimento.
              </p>
            </div>

            <div
              className="animate-fade-up flex flex-wrap gap-2"
              style={{ animationDelay: "0.3s" }}
            >
              <StatBadge label="Planos" value="Elegíveis" delay="0s" />
              <StatBadge label="Reajustes" value="IGP-M·IPCA" delay="0.4s" />
              <StatBadge label="Comparativo" value="Tempo real" delay="0.8s" />
            </div>
          </div>

          <p
            className="animate-fade-up text-[11px] text-muted-foreground/50"
            style={{ animationDelay: "0.4s" }}
          >
            © 2026 Soren Consórcios
          </p>
        </div>

        {/* ── PAINEL DIREITO — formulário ── */}
        <div className="flex flex-1 items-center justify-center px-4 py-12 md:px-8 md:py-0">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

"use client";

import Image from "next/image";
import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <div className="login-card-glow relative w-full max-w-[360px] rounded-2xl border border-white/[0.08] bg-card/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Linha de acento superior */}
      <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      {/* Logo mobile (visível só em telas pequenas) */}
      <div
        className="animate-fade-up mb-6 flex justify-center md:hidden"
        style={{ animationDelay: "0.1s" }}
      >
        <Image
          src="/soren-logo.png"
          alt="Soren"
          width={925}
          height={241}
          priority
          className="h-9 w-auto"
        />
      </div>

      <div
        className="animate-fade-up mb-7 space-y-1"
        style={{ animationDelay: "0.2s" }}
      >
        <h2 className="font-heading text-xl font-bold tracking-tight text-card-foreground">
          Soren Consórcios
        </h2>
        <p className="text-xs text-muted-foreground">
          Sistema comercial de atendimento
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div
          className="animate-fade-up space-y-1.5"
          style={{ animationDelay: "0.3s" }}
        >
          <label
            htmlFor="email"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="voce@empresa.com.br"
            required
            autoComplete="email"
            className="login-input-glow w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/40 focus:bg-background/80"
          />
        </div>

        <div
          className="animate-fade-up space-y-1.5"
          style={{ animationDelay: "0.4s" }}
        >
          <label
            htmlFor="password"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="login-input-glow w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/40 focus:bg-background/80"
          />
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}

        <div className="animate-fade-up pt-1" style={{ animationDelay: "0.5s" }}>
          <button
            type="submit"
            disabled={pending}
            className="login-btn-glow w-full rounded-md px-4 py-2.5 text-sm disabled:transform-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>
        </div>
      </form>

      {/* Indicador de status */}
      <div
        className="animate-fade-up mt-6 flex items-center justify-center gap-1.5"
        style={{ animationDelay: "0.5s" }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Sistema online
        </span>
      </div>
    </div>
  );
}

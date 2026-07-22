"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Evita mismatch de hidratação: no servidor renderiza o ícone padrão,
// no cliente (após hidratar) passa a refletir o tema resolvido.
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Alternar tema"
      title="Alternar tema claro/escuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn("text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", className)}
    >
      {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

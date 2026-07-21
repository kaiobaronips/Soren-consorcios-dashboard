import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/repositories/profiles";

const ROLE_LABEL: Record<Profile["role"], string> = {
  admin: "Administrador",
  manager: "Gestor",
  consultant: "Consultor(a)",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function AppSidebar({ profile }: { profile: Profile }) {
  // Staff (admin/manager) veem Base de Produtos e Configurações; consultor não.
  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        {/* Logo Soren (fundo removido). A placa verde-escura da marca mantém o
            letreiro branco legível sobre a sidebar clara. */}
        <div className="flex items-center justify-center rounded-lg bg-[#0d201a] px-4 py-3">
          <Image
            src="/soren-logo.png"
            alt="Soren Consórcios"
            width={925}
            height={241}
            priority
            className="h-auto w-full max-w-[150px]"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <AppSidebarNav isStaff={profile.role !== "consultant"} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
              {initials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile.name}</p>
            <p className="text-xs text-sidebar-foreground/60">
              {ROLE_LABEL[profile.role]}
            </p>
          </div>
          <ThemeToggle />
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Sair
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}

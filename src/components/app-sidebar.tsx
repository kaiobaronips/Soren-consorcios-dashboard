import Link from "next/link";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/repositories/profiles";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/atendimento", label: "Novo atendimento" },
  { href: "/clientes", label: "Clientes" },
  { href: "/produtos", label: "Produtos" },
];

export function AppSidebar({ profile }: { profile: Profile }) {
  // Staff (admin/manager) veem Base de Produtos e Configurações; consultor não.
  const items =
    profile.role === "consultant"
      ? NAV
      : [...NAV, { href: "/base-produtos", label: "Base de Produtos" }, { href: "/configuracoes", label: "Configurações" }];
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 font-semibold">Soren Consórcios</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />}>
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 text-sm">
        <p className="truncate text-muted-foreground">{profile.name}</p>
        <form action={signOut}>
          <Button variant="outline" size="sm" className="w-full">Sair</Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}

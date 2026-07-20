"use client";

import {
  ClipboardList,
  FolderUp,
  Home,
  Package,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/atendimento", label: "Novo atendimento", icon: ClipboardList },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/produtos", label: "Produtos", icon: Package },
];

const STAFF_ITEMS = [
  { href: "/base-produtos", label: "Base de Produtos", icon: FolderUp },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppSidebarNav({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();
  const items = isStaff ? [...ITEMS, ...STAFF_ITEMS] : ITEMS;

  return (
    <SidebarMenu>
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              isActive={active}
              render={<Link href={href} />}
              className="data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground"
            >
              <Icon aria-hidden />
              {label}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

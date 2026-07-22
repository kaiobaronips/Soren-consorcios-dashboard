"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChartNoAxesCombined,
  ClipboardList,
  FileChartColumn,
  FolderUp,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import type { Profile } from "@/repositories/profiles";

type NavigationItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  staffOnly?: boolean;
};

const navigation: NavigationItem[] = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/atendimento", label: "Atendimento", icon: ClipboardList },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/inventario", label: "Inventário", icon: FolderUp },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/relatorios", label: "Relatórios", icon: FileChartColumn },
  { href: "/base-produtos", label: "Base de produtos", icon: FolderUp, staffOnly: true },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((item) => item[0]?.toUpperCase()).join("");
}

function getRouteSegments(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["Operações", "Visão geral"];

  const routeLabels: Record<string, { section: string; page: string }> = {
    atendimento: { section: "Atendimento", page: "Novo Atendimento" },
    clientes: { section: "Clientes", page: "Lista de clientes" },
    produtos: { section: "Produtos", page: "Catálogo de produtos" },
    inventario: { section: "Inventário", page: "Stats" },
    analytics: { section: "Analytics", page: "Dashboards" },
    relatorios: { section: "Relatórios", page: "Relatório detalhado" },
    "base-produtos": { section: "Base de produtos", page: "Uploads" },
    configuracoes: { section: "Configurações", page: "Preferências" },
  };

  const [sectionSegment, ...childSegments] = segments;
  const route = routeLabels[sectionSegment];
  const section = route?.section ?? sectionSegment.replace(/-/g, " ");
  const page = childSegments.length > 0
    ? childSegments[childSegments.length - 1].replace(/-/g, " ")
    : route?.page;

  return page ? [section, page] : [section];
}

function IconButton({ label, children, className, ...props }: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button aria-label={label} variant="ghost" size="icon" className={cn("enterprise-icon-button", className)} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function OperationalShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(() => typeof window !== "undefined" && localStorage.getItem("soren-sidebar-expanded") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleExpanded() {
    setExpanded((current) => {
      localStorage.setItem("soren-sidebar-expanded", String(!current));
      return !current;
    });
  }

  const visibleNavigation = navigation.filter((item) => !item.staffOnly || profile.role !== "consultant");
  const sidebar = (
    <aside className={cn("enterprise-sidebar", expanded && "enterprise-sidebar-expanded")} aria-label="Navegação principal">
      <div className="enterprise-sidebar-controls md:hidden">
        <IconButton label="Fechar menu" onClick={() => setMobileOpen(false)} className="md:hidden"><X aria-hidden /></IconButton>
      </div>
      <nav className="enterprise-sidebar-nav">
        {visibleNavigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const link = <Link href={href} onClick={() => setMobileOpen(false)} className={cn("enterprise-nav-item", active && "enterprise-nav-item-active")} aria-current={active ? "page" : undefined}><Icon aria-hidden /><span>{label}</span></Link>;
          return expanded ? <div key={href}>{link}</div> : <Tooltip key={href}><TooltipTrigger render={link} /><TooltipContent side="right">{label}</TooltipContent></Tooltip>;
        })}
      </nav>
      <div className="enterprise-sidebar-footer-controls hidden md:flex">
        <IconButton label={expanded ? "Recolher menu" : "Expandir menu"} onClick={toggleExpanded}>
          {expanded ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
        </IconButton>
      </div>
    </aside>
  );

  return (
    <div className="enterprise-shell">
      <header className="enterprise-header">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton label="Abrir menu" onClick={() => setMobileOpen(true)} className="md:hidden"><Menu aria-hidden /></IconButton>
          <Link href="/" aria-label="Soren" className="enterprise-header-logo">
            <Image src="/soren-logo-icon.png" alt="Soren" width={140} height={200} priority />
          </Link>
          <span className="enterprise-product-label"><span className="font-normal">Soren</span>{" "}<span className="font-bold">Connect Platform</span></span>
        </div>
        <div className="hidden min-w-0 flex-1 justify-center lg:flex"><label className="enterprise-global-search"><Search aria-hidden /><span className="sr-only">Busca global</span><input placeholder="Buscar clientes, produtos e simulações" /></label></div>
        <div className="flex items-center gap-1">
          <IconButton label="Configurações" nativeButton={false} render={<Link href="/configuracoes" />}><Settings aria-hidden /></IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" aria-label="Abrir menu da conta" className="ml-2 rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#78a9ff]" />}
            >
              <Avatar className="size-8"><AvatarFallback className="bg-[#0f62fe] text-xs text-white">{initials(profile.name)}</AvatarFallback></Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="enterprise-account-menu w-60 rounded-sm p-0 shadow-none">
              <div className="border-b border-[#393939] px-4 py-3"><p className="truncate text-sm font-medium text-[#f4f4f4]">{profile.name}</p><p className="mt-1 text-xs text-[#c6c6c6]">{profile.role === "admin" ? "Administrador" : profile.role === "manager" ? "Gestor" : "Consultor"}</p></div>
              <div className="flex items-center justify-between px-3 py-2"><span className="text-sm text-[#f4f4f4]">Tema</span><ThemeToggle className="text-[#c6c6c6] hover:bg-[#393939] hover:text-white" /></div>
              <form action={signOut} className="border-t border-[#393939] p-1"><button type="submit" className="w-full px-3 py-2 text-left text-sm text-[#f4f4f4] hover:bg-[#393939] focus-visible:outline-2 focus-visible:outline-[#78a9ff]">Sair</button></form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="enterprise-sidebar-desktop">{sidebar}</div>
      {mobileOpen && <div className="enterprise-mobile-sidebar"><button className="enterprise-mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />{sidebar}</div>}
      <main className={cn("enterprise-main", expanded && "enterprise-main-expanded")}>
        <nav className="enterprise-route-bar" aria-label="Rota aberta">
          {getRouteSegments(pathname).map((segment, index) => (
            <span key={`${segment}-${index}`} className={index === 0 ? "enterprise-route-primary" : "enterprise-route-secondary"}>
              {segment}
            </span>
          ))}
        </nav>
        <div className="enterprise-content">{children}</div>
      </main>
    </div>
  );
}

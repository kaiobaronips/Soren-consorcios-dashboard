"use client";

import { ChevronDown, Download, MoreVertical, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OperationalPageHeader({ title, description, eyebrow, actions }: { title: string; description?: string; eyebrow?: string; actions?: React.ReactNode }) {
  return <header className="enterprise-page-header"><div><p className="enterprise-eyebrow">{eyebrow ?? "Operações"}</p><h1 className="enterprise-page-title">{title}</h1>{description && <p className="enterprise-page-description">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>;
}

export function EnterpriseButton({ children, variant = "secondary", className, ...props }: Omit<React.ComponentProps<typeof Button>, "variant"> & { variant?: "primary" | "secondary" }) {
  return <Button className={cn("enterprise-button", variant === "primary" ? "enterprise-button-primary" : "enterprise-button-secondary", className)} {...props}>{children}</Button>;
}

export function FilterToolbar({ onRefresh, lastUpdated = "Atualizado há 4 minutos" }: { onRefresh?: () => void; lastUpdated?: string }) {
  return <div className="enterprise-toolbar" aria-label="Filtros"><button type="button" className="enterprise-filter-chip">Período: últimos 30 dias <X aria-hidden /></button><button type="button" className="enterprise-filter-chip">Status: ativo <X aria-hidden /></button><button type="button" className="enterprise-reset">Redefinir filtros</button><span className="ml-auto text-xs text-[#6f6f6f]">{lastUpdated}</span><EnterpriseButton onClick={onRefresh} aria-label="Atualizar dados"><RefreshCw aria-hidden /> Atualizar</EnterpriseButton><EnterpriseButton aria-label="Exportar relatório"><Download aria-hidden /> Exportar</EnterpriseButton></div>;
}

export function MetricCard({ label, value, delta, tone = "positive" }: { label: string; value: string; delta: string; tone?: "positive" | "neutral" | "danger" }) {
  return <section className="enterprise-card col-span-12 sm:col-span-6 xl:col-span-2"><div className="enterprise-card-content"><p className="enterprise-metric-label">{label}</p><p className="enterprise-metric-value">{value}</p><p className={cn("enterprise-metric-delta", tone === "neutral" && "text-[#525252]", tone === "danger" && "text-[#da1e28]")}>{delta}</p></div></section>;
}

export function Panel({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return <section className={cn("enterprise-card", className)}><header className="enterprise-card-header"><h2 className="enterprise-card-title">{title}</h2>{action ?? <button className="text-[#525252]" aria-label={`Mais opções de ${title}`}><MoreVertical className="size-5" aria-hidden /></button>}</header>{children}</section>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "Ativo" || status === "Online" || status === "Healthy" ? "success" : status === "Atenção" || status === "Pendente" ? "warning" : status === "Erro" ? "danger" : "neutral";
  return <span className={`enterprise-status enterprise-status-${tone}`}>{status}</span>;
}

export function ContextSidebar({ active = "Visão geral" }: { active?: string }) {
  const groups = [["Dashboards", ["Visão geral", "Produtos", "Clientes", "Status", "Latência", "Consumo", "Operações", "Dados"]], ["Relatórios", ["Tendências de atendimento", "Uso de produtos", "Produtos inativos", "Desempenho por equipe"]]] as const;
  return <aside className="enterprise-context-sidebar" aria-label="Navegação de analytics"><h2>Analytics <ChevronDown className="float-right size-4" aria-hidden /></h2>{groups.map(([label, items]) => <div key={label}><h3>{label}</h3>{items.map((item) => <a key={item} href="#" aria-current={item === active ? "page" : undefined}>{item}</a>)}</div>)}</aside>;
}

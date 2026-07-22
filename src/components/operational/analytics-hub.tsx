"use client";

import { Activity, ChartNoAxesCombined, CircleCheck, Database, LayoutDashboard, Package, ReceiptText, Workflow } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { dashboardNavigation } from "@/data/operational-mock-data";
import { ContextSidebar, FilterToolbar, OperationalPageHeader } from "@/components/operational/enterprise-ui";

const icons = { LayoutDashboard, Package, Activity, CircleCheck, ChartNoAxesCombined, ReceiptText, Workflow, Database };
export function AnalyticsHub() {
  const [tab, setTab] = useState("Dashboards");
  return <div className="-m-6 flex min-h-[calc(100dvh-52px)] md:-m-6 lg:-m-8"><div className="hidden lg:block"><ContextSidebar /></div><div className="min-w-0 flex-1 p-6 lg:p-8"><OperationalPageHeader eyebrow="Analytics" title="Analytics" description="Selecione uma visão para analisar a operação comercial."/><div className="mt-6 enterprise-tabs" role="tablist">{["Dashboards", "Explorar", "Relatórios"].map((item) => <button key={item} className={`enterprise-tab ${tab === item ? "enterprise-tab-active" : ""}`} onClick={() => setTab(item)} role="tab" aria-selected={tab === item}>{item}</button>)}</div><FilterToolbar/><div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboardNavigation.map((item) => { const Icon = icons[item.icon as keyof typeof icons]; return <Link key={item.title} href="/relatorios" className="enterprise-card block min-h-44 p-5 no-underline transition-colors hover:border-[#0f62fe] hover:bg-[#edf5ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe]"><Icon className="size-8 text-[#161616]" strokeWidth={1.7} aria-hidden/><h2 className="mt-7 text-xl font-normal text-[#161616]">{item.title}</h2><p className="mt-2 text-sm leading-5 text-[#525252]">{item.description}</p></Link>; })}</div></div></div>;
}

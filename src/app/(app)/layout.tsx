import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentProfile } from "@/repositories/profiles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <SidebarProvider>
      <AppSidebar profile={profile} />
      <main className="min-w-0 flex-1 p-6">
        <SidebarTrigger className="mb-4 lg:hidden" />
        {children}
      </main>
    </SidebarProvider>
  );
}

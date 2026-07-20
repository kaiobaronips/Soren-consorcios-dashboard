import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentProfile } from "@/repositories/profiles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <SidebarProvider>
      <AppSidebar profile={profile} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8 print:max-w-none print:p-0">
          <SidebarTrigger className="mb-4 lg:hidden" />
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}

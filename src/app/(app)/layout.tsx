import { OperationalShell } from "@/components/layout/operational-shell";
import { getCurrentProfile } from "@/repositories/profiles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <OperationalShell profile={profile}>{children}</OperationalShell>
  );
}

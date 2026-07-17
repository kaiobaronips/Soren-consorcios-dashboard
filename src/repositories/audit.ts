import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";

export async function logAudit(params: {
  action: string;
  entityType: string;
  entityId?: string;
  previousState?: unknown;
  newState?: unknown;
}): Promise<void> {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: profile.organizationId,
    user_id: profile.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    previous_state: params.previousState ?? null,
    new_state: params.newState ?? null,
  });
  // Auditoria não pode derrubar a operação principal; falha é logada no servidor.
  if (error) console.error("audit_logs insert falhou:", error.message);
}

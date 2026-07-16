import { createServerSupabase } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "consultant";
};

/** Perfil do usuário logado. Lança erro se não autenticado (rotas já protegidas pelo middleware). */
export async function getCurrentProfile(): Promise<Profile> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, organization_id, name, email, role")
    .eq("id", user.id)
    .single();
  if (error || !data) throw new Error("Perfil não encontrado");
  return {
    id: data.id,
    organizationId: data.organization_id,
    name: data.name,
    email: data.email,
    role: data.role,
  };
}

import Decimal from "decimal.js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/repositories/profiles";

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  monthlyIncome: string | null;
  monthlyAvailableAmount: string | null;
  consultantId: string;
  status: string;
  createdAt: string;
};

const COLUMNS = "id, name, email, phone, monthly_income, monthly_available_amount, consultant_id, status, created_at";

/**
 * PostgREST devolve colunas NUMERIC como number no JSON (perde zeros à direita).
 * Os campos abaixo chegam como number em runtime mesmo o tipo declarando string;
 * normalizamos com decimal.js para a string canônica antes de expor ao domínio.
 */
export type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  monthly_income: number | null;
  monthly_available_amount: number | null;
  consultant_id: string;
  status: string;
  created_at: string;
};

export function toClient(r: Row): Client {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    monthlyIncome: r.monthly_income === null ? null : new Decimal(r.monthly_income).toFixed(2),
    monthlyAvailableAmount: r.monthly_available_amount === null
      ? null
      : new Decimal(r.monthly_available_amount).toFixed(2),
    consultantId: r.consultant_id,
    status: r.status,
    createdAt: r.created_at,
  };
}

/** Busca incremental por nome/email/telefone. RLS filtra por papel (consultor vê só os seus). */
export async function searchClients(term: string, limit = 20): Promise<Client[]> {
  const supabase = await createServerSupabase();
  // Vírgulas, parênteses e '%' quebram a sintaxe do .or(...) do PostgREST; removemos antes de montar o filtro.
  const sanitized = term.replace(/[,()%]/g, " ").trim();
  let q = supabase.from("clients").select(COLUMNS).order("name").limit(limit);
  if (sanitized) {
    q = q.or(`name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
  }
  q = q.is("deleted_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Row[]).map(toClient);
}

/** Lista clientes visíveis ao usuário (RLS aplica o filtro por papel/org). */
export async function listClients(): Promise<Client[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("clients").select(COLUMNS).is("deleted_at", null).order("name");
  if (error) throw error;
  return (data as Row[]).map(toClient);
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("clients").select(COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data ? toClient(data as Row) : null;
}

export type NewClient = {
  name: string;
  email?: string | null;
  phone?: string | null;
  monthlyIncome?: string | null;
  monthlyAvailableAmount?: string | null;
};

/** Insere cliente. RLS (policy clients_insert) exige organization_id da org do usuário; consultant_id = perfil atual. */
export async function insertClient(data: NewClient): Promise<string> {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabase();
  const { data: inserted, error } = await supabase.from("clients").insert({
    organization_id: profile.organizationId,
    consultant_id: profile.id,
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    monthly_income: data.monthlyIncome ?? null,
    monthly_available_amount: data.monthlyAvailableAmount ?? null,
  }).select("id").single();
  if (error) throw error;
  return inserted.id;
}

export async function updateClient(id: string, data: NewClient): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("clients").update({
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    monthly_income: data.monthlyIncome ?? null,
    monthly_available_amount: data.monthlyAvailableAmount ?? null,
  }).eq("id", id).is("deleted_at", null);
  if (error) throw error;
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("clients").update({
    status: "inactive",
    deleted_at: new Date().toISOString(),
  }).eq("id", id).is("deleted_at", null);
  if (error) throw error;
}

/** Atualiza os dados financeiros do cliente. RLS (policy clients_update) restringe ao consultor dono ou staff. */
export async function updateClientFinancials(
  id: string,
  monthlyIncome: string | null,
  monthlyAvailableAmount: string,
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("clients").update({
    monthly_income: monthlyIncome,
    monthly_available_amount: monthlyAvailableAmount,
  }).eq("id", id);
  if (error) throw error;
}

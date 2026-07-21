import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { syncIndexesFromBcb } from "@/services/sync-indexes";

// Executa no Node (usa fetch externo + service role); nunca em cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rota de cron (Vercel Cron, diária — ver vercel.json) que sincroniza os índices
 * econômicos com o SGS do Banco Central. Protegida por CRON_SECRET: a Vercel envia
 * `Authorization: Bearer <CRON_SECRET>` automaticamente quando a env está configurada.
 * Falha da API externa não é erro fatal — o fallback preserva o último valor bom.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const result = await syncIndexesFromBcb(admin);
  return NextResponse.json({ ok: true, ...result });
}

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Exclui `/api` do middleware: rotas de API se autenticam sozinhas (ex.: o cron
  // `/api/cron/sync-indexes` valida CRON_SECRET). Sem isto, o gate de sessão redireciona
  // (307 → /login) a chamada do cron, que nunca tem cookie de usuário, e o job nunca roda.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

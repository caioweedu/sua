import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota TEMPORÁRIA para validar o Sentry em produção. Acesse /api/erro-teste
// e o erro deve aparecer no painel do Sentry (quando NEXT_PUBLIC_SENTRY_DSN
// estiver configurado). Pode remover este arquivo depois de confirmar.
//
// Guarda: só lança o erro quando SENTRY_TEST_ENABLED === "1", para não deixar
// um 500 exposto por engano em produção.
export async function GET() {
  if (process.env.SENTRY_TEST_ENABLED !== "1") {
    return NextResponse.json({
      ok: true,
      hint: "Defina SENTRY_TEST_ENABLED=1 na Vercel para armar o teste, acesse esta rota, veja o erro no Sentry e depois remova a env (ou este arquivo).",
    });
  }
  throw new Error("Sentry test error — validação de monitoramento (pode ignorar)");
}

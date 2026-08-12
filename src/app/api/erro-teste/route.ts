import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rota TEMPORÁRIA de diagnóstico do Sentry. Acesse /api/erro-teste e leia o
// JSON de retorno: ele diz se o DSN foi detectado, se o client inicializou e
// qual eventId foi enviado. Procure esse evento no painel do Sentry (Issues).
// Remova este arquivo depois de confirmar.
export async function GET() {
  const dsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const client = Sentry.getClient();
  const clientEnabled = client ? client.getOptions().enabled !== false : false;

  const eventId = Sentry.captureException(
    new Error("Sentry test error — validação de monitoramento (pode ignorar)")
  );

  // Em serverless (Vercel) a função pode congelar assim que responde; sem este
  // flush, o evento fica na fila e nunca é enviado ao Sentry.
  const delivered = await Sentry.flush(3000);

  return NextResponse.json({
    ok: true,
    dsnConfigured,
    clientInitialized: Boolean(client),
    clientEnabled,
    nodeEnv: process.env.NODE_ENV,
    eventId: eventId ?? null,
    flushDelivered: delivered,
    hint: !dsnConfigured
      ? "NEXT_PUBLIC_SENTRY_DSN NÃO está no ambiente. Adicione na Vercel (Production) e redeploy."
      : !client
        ? "DSN presente, mas o client não inicializou. Confira o redeploy e o valor do DSN."
        : "Evento enviado. Procure 'Sentry test error' em Issues no painel do Sentry.",
  });
}

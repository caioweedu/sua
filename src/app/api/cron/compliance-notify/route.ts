import { NextResponse } from "next/server";
import { runComplianceNotifications } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron diário (dias úteis) de notificações de compliance. Protegido por
// CRON_SECRET (header Authorization que o Vercel injeta). O resumo do gestor/RH
// sai só às segundas (ou com ?weekly=1 para teste manual).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  // Base absoluta para os links dos e-mails (a partir do host da requisição).
  const host = request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const now = new Date();
  // Resumo semanal do gestor: segundas (UTC) ou forçado por querystring.
  const weekly = url.searchParams.get("weekly") === "1" || now.getUTCDay() === 1;
  // Diagnóstico (só teste): debug detalha destinatário+resposta do Resend;
  // force ignora o anti-duplicata para permitir reenviar.
  const debug = url.searchParams.get("debug") === "1";
  const force = url.searchParams.get("force") === "1";

  try {
    const result = await runComplianceNotifications({ baseUrl, weekly, now, debug, force });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "erro" },
      { status: 500 }
    );
  }
}

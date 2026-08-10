import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep-alive do Neon (plano Free): um SELECT 1 barato mantém o banco "acordado"
// durante o expediente, evitando o cold start (~1-3s) na primeira visita.
// Chamado pelo Vercel Cron (ver vercel.json). Se CRON_SECRET estiver definido,
// exige o header Authorization que o Vercel injeta; senão, roda aberto (o
// endpoint não expõe nada além de um ping).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

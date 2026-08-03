import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seedData";

export const runtime = "nodejs";

// Popula o banco de produção uma única vez, de forma segura.
// Uso: acesse /api/seed?secret=SEU_SEGREDO (defina SEED_SECRET no ambiente).
export async function GET(req: NextRequest) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return json({ error: "SEED_SECRET não configurado no ambiente." }, 503);
  }
  if (req.nextUrl.searchParams.get("secret") !== secret) {
    return json({ error: "Segredo inválido." }, 401);
  }

  // Não sobrescreve um banco que já tem dados de trilhas.
  const jaTemDados = (await prisma.tenant.count()) > 0;
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (jaTemDados && !force) {
    return json(
      {
        ok: true,
        message:
          "Banco já possui dados. Nada foi alterado. (Use &force=1 para repovoar as trilhas de demonstração.)",
      },
      200
    );
  }

  try {
    const res = await seedDatabase(prisma);
    return json(
      {
        ok: true,
        message: "Banco populado com sucesso.",
        ...res,
        logins: {
          superAdmin: "admin@weedu.com.br / weedu123",
          aluno: "aluno@weedu.com.br / aluno123",
          adminFilha: "admin@clientedemo.com / cliente123",
        },
      },
      200
    );
  } catch (e) {
    return json({ error: "Falha ao popular: " + String(e) }, 500);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

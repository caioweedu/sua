import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import CopilotoClient from "./copiloto-client";

// Copiloto de IA para criação (Fase 5): o gestor cola um texto ou sobe um PDF
// e a IA propõe a estrutura do curso + quiz, editável antes de publicar.
export default async function CopilotoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const vitrines = await prisma.vitrine.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  const configurado = !!process.env.ANTHROPIC_API_KEY;

  return (
    <AdminShell user={user} tenant={user.tenant}>
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Administração
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">✨ Copiloto de criação</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Cole um material (manual, política, apostila) ou envie um PDF. A IA propõe
        a estrutura do curso — produto, módulos, aulas e um quiz com gabarito.
        Você revisa e edita tudo antes de publicar.
      </p>

      {!configurado && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          O copiloto precisa da chave <code>ANTHROPIC_API_KEY</code> configurada no
          projeto. Fale com o responsável técnico.
        </p>
      )}

      <div className="max-w-3xl">
        <CopilotoClient vitrines={vitrines} />
      </div>
    </AdminShell>
  );
}

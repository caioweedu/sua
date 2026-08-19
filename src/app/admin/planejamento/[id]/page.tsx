import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contentTenantIds, visibleVitrineWhere } from "@/lib/access";
import { loadUserAgenda } from "@/lib/agenda";
import AgendaEditor from "@/components/AgendaEditor";
import AppShell from "@/components/AppShell";

// Onda 3 · F3b — planejamento de um colaborador (a partir do painel de RH).
export default async function PlanejamentoPessoaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const student = await prisma.user.findFirst({
    where: { id, tenantId: user.tenantId, role: { in: ["STUDENT", "HR"] } },
    select: { id: true, name: true, email: true, teamId: true },
  });
  if (!student) notFound();

  const contentIds = contentTenantIds(user.tenant);
  const vitrineWhere = await visibleVitrineWhere(user.tenant);
  const [vitrines, orphans, agenda] = await Promise.all([
    prisma.vitrine.findMany({
      where: vitrineWhere,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        trilhas: {
          where: { published: true },
          orderBy: [{ order: "asc" }, { title: "asc" }],
          select: { id: true, title: true },
        },
      },
    }),
    prisma.trilha.findMany({
      where: { tenantId: user.tenantId, published: true, vitrineId: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    loadUserAgenda(id, user.tenantId, student.teamId, contentIds),
  ]);

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mb-6">
        <Link href="/admin/planejamento" className="text-sm text-slate-500 hover:text-ink">← Planejamento</Link>
        <h1 className="mt-1 text-2xl font-bold">Planejamento de {student.name}</h1>
        <p className="text-sm text-slate-500">
          {student.email} · <Link href={`/admin/alunos/${student.id}`} className="text-brand hover:underline">ver ficha completa</Link>
        </p>
      </div>

      <div className="card mx-auto max-w-3xl">
        <h2 className="mb-1 font-semibold">Agenda de treinamentos</h2>
        <p className="mb-4 text-xs text-slate-500">
          Escolha os treinamentos (por vitrine — todos ou alguns) e o período
          previsto. Itens herdados da equipe aparecem como (equipe).
        </p>
        <AgendaEditor student={{ id: student.id, name: student.name }} agenda={agenda} vitrines={vitrines} orphans={orphans} />
      </div>
    </AppShell>
  );
}

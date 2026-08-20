import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contentTenantIds, grantedSharedVitrineIds } from "@/lib/access";
import { loadStudentDetail } from "@/lib/analytics";
import { loadTeamCockpitData, visibleMemberIds } from "@/lib/teamCockpit";
import AppShell from "@/components/AppShell";

// Onda 3 · F2 — Ficha individual SÓ LEITURA para gestor/supervisor/RH.
// Respeita o escopo de cada papel (mesma regra do painel /minha-equipe): a
// pessoa precisa estar dentro do que quem olha pode ver, senão 404. Sem edição —
// a ficha editável (com dados/senha/perfil) segue só no admin (/admin/alunos).
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default async function EquipePessoaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isHR = user.role === "HR";
  const isAdminUser = isAdmin(user.role);

  const leads = await prisma.teamLead.findMany({
    where: { userId: user.id, team: { tenantId: user.tenantId } },
    select: { role: true, team: { select: { id: true } } },
  });
  // Sem papel de RH e sem liderar equipe → não há painel/ficha a mostrar.
  if (!isHR && !isAdminUser && leads.length === 0) redirect("/dashboard");

  // Conteúdo considerado: próprio + o liberado pela Weedu (para filhas).
  const isDaughter = user.tenant.type === "DAUGHTER" && !!user.tenant.parentId;
  const granted = isDaughter ? await grantedSharedVitrineIds(user.tenant) : [];
  const trilhaWhere = isDaughter
    ? { OR: [{ tenantId: user.tenantId }, { vitrineId: { in: granted } }] }
    : { tenantId: user.tenantId };

  const data = await loadTeamCockpitData(user.tenantId, trilhaWhere);
  const companyWide = isHR || isAdminUser;
  const allowed = visibleMemberIds(data, {
    companyWide,
    managerTeamIds: leads.filter((l) => l.role === "MANAGER").map((l) => l.team.id),
    supervisorTeamIds: leads.filter((l) => l.role === "SUPERVISOR").map((l) => l.team.id),
  });
  // Segurança da informação: só abre a ficha de quem está no seu escopo.
  if (!allowed.has(id)) notFound();

  const detail = await loadStudentDetail(user.tenantId, id, contentTenantIds(user.tenant));
  if (!detail) notFound();
  const { student, totals, courses } = detail;

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mb-6">
        <Link href="/minha-equipe" className="text-sm text-slate-500 hover:text-ink">
          ← Acompanhamento da equipe
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{student.name}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            só leitura
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {student.email}
          {student.phone ? ` · ${student.phone}` : ""} ·{" "}
          {student.accessProfile?.name ?? "Acesso total"} · desde {fmtDate(student.createdAt)}
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: "Matrículas", value: totals.enrolled },
          { label: "Concluídos", value: totals.completed },
          { label: "Aulas feitas", value: totals.aulasDone },
          { label: "Certificados", value: totals.certificates },
          { label: "Nota média", value: totals.avgScore != null ? `${totals.avgScore}%` : "—" },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-black text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cursos da pessoa */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold">Cursos</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-slate-500">Esta pessoa ainda não se matriculou em nenhum curso.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-4">Curso</th>
                  <th className="pb-2 pr-4">Situação</th>
                  <th className="pb-2 pr-4">Progresso</th>
                  <th className="pb-2 pr-4">Nota</th>
                  <th className="pb-2 pr-4">Tempo</th>
                  <th className="pb-2 pr-4">Certificado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 font-medium text-ink">{c.title}</td>
                    <td className="py-2 pr-4">
                      {c.status === "COMPLETED" ? (
                        <span className="text-green-600">Concluído</span>
                      ) : (
                        <span className="text-amber-600">Em andamento</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${c.progressPct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">
                          {c.aulasDone}/{c.aulasTotal}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      {c.bestScore != null ? (
                        <span className={c.passed ? "text-green-600" : "text-slate-600"}>
                          {c.bestScore}%{c.passed ? " ✓" : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {c.completionDays != null ? (
                        <span>{c.completionDays === 0 ? "no mesmo dia" : `${c.completionDays} dia(s)`}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {c.certCode ? (
                        <Link href={`/certificados/${c.certCode}`} className="text-brand hover:underline">
                          🏆 {fmtDate(c.certIssuedAt)}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

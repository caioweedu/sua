import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadStudentDetail } from "@/lib/analytics";
import { contentTenantIds } from "@/lib/access";
import { emailConfigured } from "@/lib/email";
import { updateUser, resetUserPassword } from "@/lib/actions/users";
import AppShell from "@/components/AppShell";
import SubmitButton from "@/components/SubmitButton";
import StudentAccessCard from "./student-access-card";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const { id } = await params;
  const detail = await loadStudentDetail(user.tenantId, id, contentTenantIds(user.tenant));
  if (!detail) notFound();
  const { student, totals, courses } = detail;

  const profiles = await prisma.accessProfile.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: { accessProfileId: true, teamId: true, role: true },
  });
  const currentProfileId = dbUser?.accessProfileId ?? "";
  const currentTeamId = dbUser?.teamId ?? "";
  const currentRole = dbUser?.role ?? "STUDENT";

  // Equipes do tenant (organograma) para alocar o aluno.
  const teams = await prisma.team.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mb-6">
        <Link href="/admin/analytics" className="text-sm text-slate-500 hover:text-ink">
          ← Resultados
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{student.name}</h1>
          {student.active ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              ativo
            </span>
          ) : (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
              inativo
            </span>
          )}
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

      {/* Cursos do aluno */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold">Cursos do aluno</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-slate-500">Este aluno ainda não se matriculou em nenhum curso.</p>
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

      {/* Agenda de treinamentos (F3 — gerida no painel de RH) */}
      <div className="card mt-6">
        <h2 className="mb-1 font-semibold">Agenda de treinamentos</h2>
        <p className="mb-3 text-xs text-slate-500">
          O planejamento de treinamentos desta pessoa (o que fazer e até quando)
          fica no painel de RH.
        </p>
        <Link href={`/admin/planejamento/${student.id}`} className="btn-outline text-sm">
          🗓️ Abrir planejamento de {student.name.split(" ")[0]}
        </Link>
      </div>

      {/* Edição + acesso */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-semibold">Dados do aluno</h2>
          <form action={updateUser.bind(null, student.id)} className="space-y-3">
            <div>
              <label className="label">Nome</label>
              <input name="name" defaultValue={student.name} required className="input" />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input name="email" type="email" defaultValue={student.email} required className="input" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input name="phone" defaultValue={student.phone ?? ""} className="input" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="label">Perfil de acesso</label>
              <select name="accessProfileId" defaultValue={currentProfileId} className="input">
                <option value="">Acesso total (sem perfil)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Equipe (organograma)</label>
              <select name="teamId" defaultValue={currentTeamId} className="input">
                <option value="">Sem equipe</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Independente do perfil de acesso. Defina a árvore em{" "}
                <Link href="/admin/equipes" className="text-brand hover:underline">Equipes</Link>.
              </p>
            </div>
            <div>
              <label className="label">Papel</label>
              <select name="role" defaultValue={currentRole === "HR" ? "HR" : "STUDENT"} className="input">
                <option value="STUDENT">Aluno (colaborador)</option>
                <option value="HR">RH (vê o painel de pessoas da empresa)</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                RH é só leitura sobre pessoas (painel em{" "}
                <Link href="/minha-equipe" className="text-brand hover:underline">Minha equipe</Link>) — não edita conteúdo.
                Gestor/supervisor são definidos em{" "}
                <Link href="/admin/equipes" className="text-brand hover:underline">Equipes</Link>.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="active" defaultChecked={student.active} /> Aluno ativo (pode acessar)
            </label>
            <SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton>
          </form>

          <form action={resetUserPassword.bind(null, student.id)} className="mt-6 space-y-3 border-t border-slate-100 pt-4">
            <label className="label">Redefinir senha manualmente</label>
            <div className="flex gap-2">
              <input name="password" type="password" minLength={6} required className="input flex-1" placeholder="Nova senha (mín. 6)" />
              <SubmitButton className="btn-outline text-sm" pendingText="…">Salvar senha</SubmitButton>
            </div>
            <p className="text-xs text-slate-400">
              Define a senha na hora, sem link. Para o aluno criar a própria, use o convite ao lado.
            </p>
          </form>
        </div>

        <StudentAccessCard userId={student.id} studentEmail={student.email} emailConfigured={emailConfigured()} />
      </div>
    </AppShell>
  );
}

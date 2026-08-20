import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { loadAnalytics } from "@/lib/analytics";
import { grantedSharedVitrineIds } from "@/lib/access";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  // Produtos considerados: próprios + os liberados pela Weedu (para filhas).
  const isDaughter = user.tenant.type === "DAUGHTER" && !!user.tenant.parentId;
  const granted = isDaughter ? await grantedSharedVitrineIds(user.tenant) : [];
  const trilhaWhere = isDaughter
    ? { OR: [{ tenantId: user.tenantId }, { vitrineId: { in: granted } }] }
    : { tenantId: user.tenantId };
  const a = await loadAnalytics(user.tenantId, trilhaWhere);
  const maxDay = Math.max(1, ...a.engagement.days.map((d) => d.count));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">Resultados gerais da sua universidade.</p>
      </div>

      {/* Visão geral */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Alunos" value={a.overview.totalStudents} />
        <Stat label="Matrículas" value={a.overview.totalEnroll} sub={`${a.overview.activeEnroll} em andamento`} />
        <Stat label="Concluídas" value={a.overview.completedEnroll} />
        <Stat label="Conclusão" value={`${a.overview.completionRate}%`} sub="das matrículas" />
        <Stat label="Certificados" value={a.overview.totalCertificates} />
        <Stat label="Novas (30d)" value={a.engagement.newEnroll30} sub="matrículas" />
      </div>

      {/* Engajamento */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-1 font-semibold">Aulas concluídas · últimos 14 dias</h2>
          <p className="mb-4 text-xs text-slate-500">
            {a.engagement.aulas30} aulas concluídas nos últimos 30 dias.
          </p>
          <div className="flex h-40 items-end gap-1.5">
            {a.engagement.days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-brand/80"
                    style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                    title={`${d.count} aula(s)`}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-4 font-semibold">Últimos 30 dias</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Novas matrículas</span>
              <span className="font-bold text-ink">{a.engagement.newEnroll30}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Aulas concluídas</span>
              <span className="font-bold text-ink">{a.engagement.aulas30}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Certificados emitidos</span>
              <span className="font-bold text-ink">{a.engagement.cert30}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Por produto */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold">Por produto</h2>
        {a.perTrilha.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum produto ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-4">Produto</th>
                  <th className="pb-2 pr-4">Matriculados</th>
                  <th className="pb-2 pr-4">Concluídos</th>
                  <th className="pb-2 pr-4">Conclusão</th>
                  <th className="pb-2 pr-4">Aprovação (provas)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {a.perTrilha.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-4 font-medium text-ink">
                      {t.title}
                      {!t.published && <span className="ml-2 text-xs text-slate-400">(rascunho)</span>}
                    </td>
                    <td className="py-2 pr-4">{t.enrolled}</td>
                    <td className="py-2 pr-4">{t.completed}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${t.completionRate}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{t.completionRate}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      {t.attempted > 0 ? (
                        <span>
                          {t.approvalRate}% <span className="text-xs text-slate-400">({t.passed}/{t.attempted})</span>
                        </span>
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

      {/* Por aluno */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold">Por aluno</h2>
        {a.perStudent.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum aluno ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-4">Aluno</th>
                  <th className="pb-2 pr-4">Matrículas</th>
                  <th className="pb-2 pr-4">Concluídas</th>
                  <th className="pb-2 pr-4">Aulas</th>
                  <th className="pb-2 pr-4">Provas aprov.</th>
                  <th className="pb-2 pr-4">Certificados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {a.perStudent.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4">
                      <Link href={`/admin/alunos/${s.id}`} className="font-medium text-ink hover:text-brand hover:underline">
                        {s.name}
                      </Link>
                      <span className="block text-xs text-slate-400">{s.email}</span>
                    </td>
                    <td className="py-2 pr-4">{s.enrolled}</td>
                    <td className="py-2 pr-4">{s.completed}</td>
                    <td className="py-2 pr-4">{s.aulasDone}</td>
                    <td className="py-2 pr-4">{s.examsPassed}</td>
                    <td className="py-2 pr-4">{s.certificates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

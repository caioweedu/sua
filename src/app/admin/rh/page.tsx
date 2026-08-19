import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { loadAnalytics } from "@/lib/analytics";
import { grantedSharedVitrineIds } from "@/lib/access";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";

// Onda 3 — Gestão de Equipes & RH · F1 (Cockpit do RH).
// Visão da EMPRESA + por EQUIPE (drill-down na árvore), só leitura, reusando o
// analytics existente. Nesta fatia é acessível ao admin (o papel RH dedicado e
// o escopo por gestor/supervisor entram no F2). Escopo por tenant, com o
// conteúdo liberado pela mãe contabilizado (igual à página de Resultados).

type Row = {
  id: string;
  name: string;
  email: string;
  enrolled: number;
  completed: number;
  aulasDone: number;
  examsPassed: number;
  certificates: number;
};

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function RhCockpitPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  // Conteúdo considerado: próprio + o liberado pela Weedu (para filhas).
  const isDaughter = user.tenant.type === "DAUGHTER" && !!user.tenant.parentId;
  const granted = isDaughter ? await grantedSharedVitrineIds(user.tenant) : [];
  const trilhaWhere = isDaughter
    ? { OR: [{ tenantId: user.tenantId }, { vitrineId: { in: granted } }] }
    : { tenantId: user.tenantId };

  const [analytics, teams, studentTeams] = await Promise.all([
    loadAnalytics(user.tenantId, trilhaWhere),
    prisma.team.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, parentId: true },
    }),
    prisma.user.findMany({
      where: { tenantId: user.tenantId, role: "STUDENT" },
      select: { id: true, teamId: true },
    }),
  ]);

  // Índice de métricas por aluno.
  const byId = new Map<string, Row>(analytics.perStudent.map((s) => [s.id, s]));

  // Membros diretos por equipe (apenas alunos) + alunos sem equipe.
  const directMembers = new Map<string, string[]>();
  const noTeam: string[] = [];
  for (const s of studentTeams) {
    if (s.teamId) {
      if (!directMembers.has(s.teamId)) directMembers.set(s.teamId, []);
      directMembers.get(s.teamId)!.push(s.id);
    } else {
      noTeam.push(s.id);
    }
  }

  // Árvore.
  const childrenOf = new Map<string | null, typeof teams>();
  for (const t of teams) {
    const key = t.parentId ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, [] as typeof teams);
    childrenOf.get(key)!.push(t);
  }
  const roots = childrenOf.get(null) ?? [];

  // IDs de alunos de uma equipe INCLUINDO subequipes (rollup).
  function subtreeMemberIds(teamId: string): string[] {
    const ids = [...(directMembers.get(teamId) ?? [])];
    for (const c of childrenOf.get(teamId) ?? []) ids.push(...subtreeMemberIds(c.id));
    return ids;
  }

  // Agrega as métricas de uma lista de alunos.
  function agg(ids: string[]) {
    let matriculas = 0, concluidos = 0, aulas = 0, provas = 0, certs = 0, emTreino = 0;
    for (const id of ids) {
      const s = byId.get(id);
      if (!s) continue;
      matriculas += s.enrolled;
      concluidos += s.completed;
      aulas += s.aulasDone;
      provas += s.examsPassed;
      certs += s.certificates;
      if (s.enrolled > 0) emTreino++;
    }
    const pessoas = ids.length;
    return {
      pessoas,
      emTreino,
      matriculas,
      concluidos,
      aulas,
      provas,
      certs,
      adesao: pessoas ? Math.round((emTreino / pessoas) * 100) : 0,
      conclusao: matriculas ? Math.round((concluidos / matriculas) * 100) : 0,
    };
  }

  // Visão empresa (tiles do topo).
  const company = agg(studentTeams.map((s) => s.id));

  function renderNode(team: (typeof teams)[number], depth: number) {
    const kids = childrenOf.get(team.id) ?? [];
    const m = agg(subtreeMemberIds(team.id));
    const direct = (directMembers.get(team.id) ?? [])
      .map((id) => byId.get(id))
      .filter((r): r is Row => !!r)
      .sort((a, b) => a.name.localeCompare(b.name));
    return (
      <div key={team.id} style={{ marginLeft: depth === 0 ? 0 : 18 }}>
        <div
          className="rounded-xl border border-slate-200"
          style={depth > 0 ? { borderLeftWidth: 3, borderLeftColor: "var(--brand,#2563eb)" } : undefined}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-sm font-semibold text-ink">
              {depth === 0 ? "🏢" : "▸"} {team.name}
              {kids.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">(inclui subequipes)</span>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span><b className="text-ink">{m.pessoas}</b> pessoa(s)</span>
              <span>Adesão <b className="text-ink">{m.adesao}%</b></span>
              <span>Conclusão <b className="text-ink">{m.conclusao}%</b></span>
              <span><b className="text-ink">{m.certs}</b> cert.</span>
            </div>
          </div>

          {direct.length > 0 && (
            <details className="px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                Pessoas nesta equipe ({direct.length})
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-1 pr-4">Pessoa</th>
                      <th className="pb-1 pr-4">Matríc.</th>
                      <th className="pb-1 pr-4">Concl.</th>
                      <th className="pb-1 pr-4">Aulas</th>
                      <th className="pb-1 pr-4">Aprov.</th>
                      <th className="pb-1 pr-4">Cert.</th>
                      <th className="pb-1"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {direct.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1.5 pr-4 font-medium text-ink">{r.name}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{r.enrolled}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{r.completed}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{r.aulasDone}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{r.examsPassed}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{r.certificates}</td>
                        <td className="py-1.5">
                          <Link href={`/admin/alunos/${r.id}`} className="text-xs text-brand hover:underline">
                            ficha →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>

        {kids.length > 0 && (
          <div className="mt-2 space-y-2">{kids.map((k) => renderNode(k, depth + 1))}</div>
        )}
      </div>
    );
  }

  const noTeamRows = noTeam
    .map((id) => byId.get(id))
    .filter((r): r is Row => !!r);
  const noTeamAgg = agg(noTeam);

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← Administração</Link>
          <h1 className="mt-1 text-2xl font-bold">Painel de RH</h1>
          <p className="text-sm text-slate-500">
            Visão da empresa e por equipe (inclui subequipes). Só leitura.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/equipes" className="btn-outline text-sm">🏢 Equipes</Link>
          <Link href="/admin/analytics" className="btn-outline text-sm">📊 Resultados (por conteúdo)</Link>
        </div>
      </div>

      {/* Visão empresa */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Pessoas" value={analytics.overview.totalStudents} sub="alunos no total" />
        <Tile label="Em treinamento" value={`${company.adesao}%`} sub={`${company.emTreino} com matrícula`} />
        <Tile label="Conclusão média" value={`${analytics.overview.completionRate}%`} sub={`${analytics.overview.completedEnroll}/${analytics.overview.totalEnroll} matrículas`} />
        <Tile label="Certificados" value={analytics.overview.totalCertificates} sub={`${analytics.engagement.cert30} nos últimos 30 dias`} />
      </div>

      {/* Por equipe (árvore) */}
      <div className="card mt-6">
        <h2 className="mb-1 font-semibold">Por equipe</h2>
        <p className="mb-4 text-xs text-slate-500">
          Cada equipe mostra os números dela <strong>e das subequipes</strong>. Abra
          “Pessoas nesta equipe” para ver o progresso individual de quem está
          diretamente na equipe.
        </p>
        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma equipe ainda. Monte o organograma em{" "}
            <Link href="/admin/equipes" className="text-brand hover:underline">Equipes</Link>.
          </p>
        ) : (
          <div className="space-y-3">{roots.map((t) => renderNode(t, 0))}</div>
        )}

        {/* Sem equipe */}
        {noTeamRows.length > 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/40">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 px-3 py-2">
              <span className="text-sm font-semibold text-amber-700">⚠️ Sem equipe</span>
              <span className="text-xs text-slate-600">
                <b className="text-ink">{noTeamAgg.pessoas}</b> pessoa(s) · Adesão{" "}
                <b className="text-ink">{noTeamAgg.adesao}%</b> · <b className="text-ink">{noTeamAgg.certs}</b> cert.
              </span>
            </div>
            <p className="px-3 py-2 text-xs text-slate-500">
              Aloque essas pessoas em uma equipe (em{" "}
              <Link href="/admin/equipes" className="text-brand hover:underline">Equipes</Link>) para
              aparecerem no organograma acima.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

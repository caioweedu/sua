import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, canManageTeams } from "@/lib/auth";
import { contentTenantIds } from "@/lib/access";
import { loadPlanningOverview } from "@/lib/planning";
import { loadTeamTree, subtreeIds } from "@/lib/teamFilter";
import GestorNav from "@/components/GestorNav";
import Icon from "@/components/Icon";
import TeamFilterBar, { type TeamFilterItem } from "@/components/TeamFilterBar";
import ImportPlanningCard from "./import-planning-card";

// Onda 3 · F3b — Painel de planejamento (RH): lista de colaboradores com o
// status do plano (atrasados/pendentes/em dia) e acesso ao planejamento de cada
// um. Import por planilha. Escopo por tenant.

function StatusBadge({ overdue, pending, total }: { overdue: number; pending: number; total: number }) {
  if (overdue > 0)
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"><Icon name="alertTriangle" size={12} className="shrink-0" /> {overdue} atrasado(s)</span>;
  if (pending > 0)
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><Icon name="alertCircle" size={12} className="shrink-0" /> {pending} pendente(s)</span>;
  if (total > 0)
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><Icon name="check" size={12} className="shrink-0" /> em dia</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">sem plano</span>;
}

export default async function PlanejamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageTeams(user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const active = typeof sp.equipe === "string" ? sp.equipe : "all";

  const [rows, tree] = await Promise.all([
    loadPlanningOverview(user.tenantId, contentTenantIds(user.tenant)),
    loadTeamTree(user.tenantId),
  ]);

  // Membros diretos por equipe, deduzidos das próprias linhas.
  const directOf = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.teamId) continue;
    if (!directOf.has(r.teamId)) directOf.set(r.teamId, []);
    directOf.get(r.teamId)!.push(r.id);
  }

  // Resumo por equipe (não filtrado): headline = atrasos da subárvore.
  const item = (key: string, name: string, depth: number, subset: typeof rows): TeamFilterItem => {
    const overdueSum = subset.reduce((s, r) => s + r.overdue, 0);
    const pendingSum = subset.reduce((s, r) => s + r.pending, 0);
    return {
      key,
      name,
      depth,
      pessoas: subset.length,
      statValue: `${overdueSum}`,
      statLabel: "atrasados",
      tone: overdueSum > 0 ? "bad" : pendingSum > 0 ? "warn" : "good",
    };
  };
  const semEquipe = rows.filter((r) => !r.teamId);
  const items: TeamFilterItem[] = [item("all", "Todas", 0, rows)];
  for (const t of tree.ordered) {
    const ids = new Set(subtreeIds(t.id, tree.childrenOf, directOf));
    const subset = rows.filter((r) => ids.has(r.id));
    if (subset.length > 0) items.push(item(t.id, t.name, t.depth, subset));
  }
  if (semEquipe.length > 0) items.push(item("none", "Sem equipe", 0, semEquipe));

  // Escopo ativo → filtra a lista e os contadores do topo.
  let scoped = rows;
  let activeName = "";
  if (active === "none") {
    scoped = semEquipe;
    activeName = "Sem equipe";
  } else if (active !== "all") {
    const ids = new Set(subtreeIds(active, tree.childrenOf, directOf));
    scoped = rows.filter((r) => ids.has(r.id));
    activeName = tree.ordered.find((t) => t.id === active)?.name ?? "";
  }

  const comAtraso = scoped.filter((r) => r.overdue > 0).length;
  const semPlano = scoped.filter((r) => r.total === 0).length;

  return (
    <>
      <GestorNav active="planejamento" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← Administração</Link>
          <h1 className="mt-1 text-2xl font-bold">Planejamento de treinamentos</h1>
          <p className="text-sm text-slate-500">
            {scoped.length} colaborador(es) · {comAtraso} com atraso · {semPlano} sem plano.
          </p>
        </div>
      </div>

      <TeamFilterBar items={items} active={active} baseHref="/admin/planejamento" />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="card">
            <h2 className="mb-1 font-semibold">
              Colaboradores{activeName ? <span className="font-normal text-slate-400"> · {activeName}</span> : null}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Clique para ver e editar o planejamento da pessoa. Ordenado por atraso.
            </p>
            {scoped.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum colaborador ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {scoped.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/planejamento/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {r.email} · {r.total} planejado(s) · {r.done} concluído(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge overdue={r.overdue} pending={r.pending} total={r.total} />
                      <Link href={`/admin/planejamento/${r.id}`} className="btn-outline px-2 py-1 text-xs">
                        planejar
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <ImportPlanningCard />
        </section>
      </div>
    </>
  );
}

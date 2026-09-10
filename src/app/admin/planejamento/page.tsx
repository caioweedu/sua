import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, canManageTeams } from "@/lib/auth";
import { contentTenantIds } from "@/lib/access";
import { loadPlanningOverview } from "@/lib/planning";
import { loadTeamTree, subtreeIds } from "@/lib/teamFilter";
import GestorNav from "@/components/GestorNav";
import TeamFilterBar, { type TeamFilterItem } from "@/components/TeamFilterBar";
import PlanningCollabList from "@/components/PlanningCollabList";
import ImportPlanningCard from "./import-planning-card";

// Onda 3 · F3b — Painel de planejamento (RH): lista de colaboradores com o
// status do plano (atrasados/pendentes/em dia) e acesso ao planejamento de cada
// um. Import por planilha. Escopo por tenant.

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

  // Resumo por equipe (não filtrado): atrasados + pendentes (no prazo) da subárvore.
  const item = (key: string, name: string, depth: number, subset: typeof rows): TeamFilterItem => {
    const overdueSum = subset.reduce((s, r) => s + r.overdue, 0);
    // pending inclui os atrasados; "no prazo" = pending - overdue.
    const pendingOnTime = subset.reduce((s, r) => s + Math.max(0, r.pending - r.overdue), 0);
    return {
      key,
      name,
      depth,
      pessoas: subset.length,
      stats: [
        { value: `${overdueSum}`, label: "atrasados", tone: overdueSum > 0 ? "bad" : "good" },
        { value: `${pendingOnTime}`, label: "pendentes", tone: pendingOnTime > 0 ? "warn" : "neutral" },
      ],
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
              Filtre por status ou busque por nome/e-mail.
            </p>
            <PlanningCollabList rows={scoped} />
          </div>
        </section>

        <section>
          <ImportPlanningCard />
        </section>
      </div>
    </>
  );
}

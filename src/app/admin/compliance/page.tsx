import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, canManageTeams } from "@/lib/auth";
import { contentTenantIds } from "@/lib/access";
import { loadComplianceOverview, WARN_DAYS } from "@/lib/compliance";
import { loadTeamTree, subtreeIds } from "@/lib/teamFilter";
import GestorNav from "@/components/GestorNav";
import TeamFilterBar, { type TeamFilterItem } from "@/components/TeamFilterBar";
import ComplianceCollabList from "@/components/ComplianceCollabList";

// Onda 3 · F3 — Painel de Compliance (admin): conformidade dos treinamentos
// OBRIGATÓRIOS por pessoa, considerando validade/recorrência. Só leitura.
// Escopo por tenant, com o conteúdo liberado pela mãe contabilizado.

function Tile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-black ${tone ?? "text-ink"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}


export default async function CompliancePage({
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
    loadComplianceOverview(user.tenantId, contentTenantIds(user.tenant)),
    loadTeamTree(user.tenantId),
  ]);

  // Membros diretos por equipe, deduzidos das próprias linhas (sem consulta extra).
  const directOf = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.teamId) continue;
    if (!directOf.has(r.teamId)) directOf.set(r.teamId, []);
    directOf.get(r.teamId)!.push(r.id);
  }

  // Resumo por equipe (não filtrado): vencidos + pendentes por subárvore.
  const item = (key: string, name: string, depth: number, subset: typeof rows): TeamFilterItem => {
    const vencSum = subset.reduce((s, r) => s + r.vencido, 0);
    const pendSum = subset.reduce((s, r) => s + r.pendente, 0);
    return {
      key,
      name,
      depth,
      pessoas: subset.length,
      stats: [
        { value: `${vencSum}`, label: "vencidos", tone: vencSum > 0 ? "bad" : "good" },
        { value: `${pendSum}`, label: "pendentes", tone: pendSum > 0 ? "warn" : "neutral" },
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

  // Escopo ativo → filtra os tiles e a lista.
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

  const comObrigatorio = scoped.filter((r) => r.total > 0);
  const conformes = comObrigatorio.filter((r) => r.conforme).length;
  const comVencido = scoped.filter((r) => r.vencido > 0).length;
  const comPendente = scoped.filter((r) => r.pendente > 0).length;
  const aVencer = scoped.reduce((s, r) => s + r.aVencer, 0);
  const conformidadePct =
    comObrigatorio.length > 0 ? Math.round((conformes / comObrigatorio.length) * 100) : 100;

  return (
    <>
      <GestorNav active="compliance" />
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← Administração</Link>
        <h1 className="mt-1 text-2xl font-bold">Compliance de treinamentos</h1>
        <p className="text-sm text-slate-500">
          Conformidade dos treinamentos <strong>obrigatórios</strong>, com validade e
          recorrência (ex.: NRs anuais). Piores primeiro. Só leitura.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile
          label="Conformidade"
          value={`${conformidadePct}%`}
          sub={`${conformes}/${comObrigatorio.length} pessoas em conformidade`}
          tone={conformidadePct >= 90 ? "text-emerald-600" : conformidadePct >= 70 ? "text-amber-600" : "text-red-600"}
        />
        <Tile label="Com vencidos" value={comVencido} sub="pessoas com treino vencido" tone={comVencido > 0 ? "text-red-600" : "text-ink"} />
        <Tile label="Com pendências" value={comPendente} sub="obrigatórios não concluídos" tone={comPendente > 0 ? "text-amber-600" : "text-ink"} />
        <Tile label="A vencer" value={aVencer} sub={`vencem em até ${WARN_DAYS} dias`} tone={aVencer > 0 ? "text-amber-600" : "text-ink"} />
      </div>

      <TeamFilterBar items={items} active={active} baseHref="/admin/compliance" />

      <div className="card mt-6">
        <h2 className="mb-1 font-semibold">
          Por colaborador{activeName ? <span className="font-normal text-slate-400"> · {activeName}</span> : null}
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Considera treinamentos obrigatórios atribuídos direto à pessoa e herdados da
          equipe. Clique para ver e ajustar o planejamento de cada um.
        </p>
        {comObrigatorio.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum treinamento obrigatório atribuído ainda. Marque treinamentos como
            obrigatórios (e defina a validade) no{" "}
            <Link href="/admin/planejamento" className="text-brand hover:underline">Planejamento</Link>.
          </p>
        ) : (
          <ComplianceCollabList rows={comObrigatorio} />
        )}
      </div>
    </>
  );
}

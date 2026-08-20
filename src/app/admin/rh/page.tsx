import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { grantedSharedVitrineIds } from "@/lib/access";
import { loadTeamCockpitData, aggMembers } from "@/lib/teamCockpit";
import TeamCockpit from "@/components/TeamCockpit";
import GestorNav from "@/components/GestorNav";

// Onda 3 · F1 — Cockpit do RH (admin): visão da empresa + por equipe, só
// leitura. Escopo por tenant, com o conteúdo liberado pela mãe contabilizado.
// O painel escopado por gestor/supervisor (F2) vive em /minha-equipe.

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

  const data = await loadTeamCockpitData(user.tenantId, trilhaWhere);
  const company = aggMembers(data.allStudentIds, data.byId);
  const noTeamAgg = aggMembers(data.noTeam, data.byId);

  return (
    <>
      <GestorNav active="rh" />
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← Administração</Link>
        <h1 className="mt-1 text-2xl font-bold">Painel Gestor</h1>
        <p className="text-sm text-slate-500">
          Visão da empresa e por equipe (inclui subequipes). Só leitura.
        </p>
      </div>

      {/* Visão empresa */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Pessoas" value={data.overview.totalStudents} sub="alunos no total" />
        <Tile label="Em treinamento" value={`${company.adesao}%`} sub={`${company.emTreino} com matrícula`} />
        <Tile label="Conclusão média" value={`${data.overview.completionRate}%`} sub={`${data.overview.completedEnroll}/${data.overview.totalEnroll} matrículas`} />
        <Tile label="Certificados" value={data.overview.totalCertificates} sub={`${data.cert30} nos últimos 30 dias`} />
      </div>

      {/* Por equipe (árvore) */}
      <div className="card mt-6">
        <h2 className="mb-1 font-semibold">Por equipe</h2>
        <p className="mb-4 text-xs text-slate-500">
          Cada equipe mostra os números dela <strong>e das subequipes</strong>. Abra
          “Pessoas nesta equipe” para ver o progresso individual de quem está
          diretamente na equipe.
        </p>
        {data.teams.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma equipe ainda. Monte o organograma em{" "}
            <Link href="/admin/equipes" className="text-brand hover:underline">Equipes</Link>.
          </p>
        ) : (
          <TeamCockpit data={data} roots={data.roots} mode="tree" />
        )}

        {data.noTeam.length > 0 && (
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
    </>
  );
}

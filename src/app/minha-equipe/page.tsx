import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { grantedSharedVitrineIds } from "@/lib/access";
import {
  loadTeamCockpitData,
  aggMembers,
  subtreeMemberIds,
  type TeamNode,
} from "@/lib/teamCockpit";
import { prisma } from "@/lib/db";
import TeamCockpit from "@/components/TeamCockpit";
import AppShell from "@/components/AppShell";

// Onda 3 · F2 — Painel escopado por papel/liderança (segurança da informação):
//  - RH: vê a empresa toda (mesma visão do cockpit do admin).
//  - Gestor (TeamLead MANAGER): vê a(s) sua(s) equipe(s) E toda a subárvore,
//    com drill-down até o individual.
//  - Supervisor (TeamLead SUPERVISOR): vê apenas a própria equipe (membros
//    diretos), sem descer para outras equipes.
// Ninguém enxerga fora do seu escopo.

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function MinhaEquipePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isHR = user.role === "HR";
  const isAdminUser = isAdmin(user.role);

  // Lideranças deste usuário (gestor/supervisor), restritas ao seu tenant.
  const leads = await prisma.teamLead.findMany({
    where: { userId: user.id, team: { tenantId: user.tenantId } },
    select: { role: true, team: { select: { id: true, name: true, parentId: true } } },
  });

  // Sem papel de RH e sem liderar nenhuma equipe → não há painel a mostrar.
  if (!isHR && !isAdminUser && leads.length === 0) redirect("/dashboard");

  // Conteúdo considerado: próprio + o liberado pela Weedu (para filhas).
  const isDaughter = user.tenant.type === "DAUGHTER" && !!user.tenant.parentId;
  const granted = isDaughter ? await grantedSharedVitrineIds(user.tenant) : [];
  const trilhaWhere = isDaughter
    ? { OR: [{ tenantId: user.tenantId }, { vitrineId: { in: granted } }] }
    : { tenantId: user.tenantId };

  const data = await loadTeamCockpitData(user.tenantId, trilhaWhere);

  // Empresa toda para RH/admin; senão, o escopo da liderança.
  const companyWide = isHR || isAdminUser;

  // Equipes lideradas, resolvidas contra a árvore atual (ignora as removidas).
  const teamById = new Map(data.teams.map((t) => [t.id, t]));
  const managerTeams: TeamNode[] = [];
  const supervisorTeams: TeamNode[] = [];
  for (const l of leads) {
    const t = teamById.get(l.team.id);
    if (!t) continue;
    (l.role === "SUPERVISOR" ? supervisorTeams : managerTeams).push(t);
  }

  // Conjunto de alunos do escopo (para os tiles do topo).
  const scopeIds = new Set<string>();
  if (companyWide) {
    data.allStudentIds.forEach((id) => scopeIds.add(id));
  } else {
    for (const t of managerTeams) subtreeMemberIds(t.id, data).forEach((id) => scopeIds.add(id));
    for (const t of supervisorTeams) (data.directMembers.get(t.id) ?? []).forEach((id) => scopeIds.add(id));
  }
  const scope = aggMembers([...scopeIds], data.byId);

  const scopeLabel = companyWide ? "Empresa" : "Sua equipe";

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-ink">← Meus treinamentos</Link>
        <h1 className="mt-1 text-2xl font-bold">
          {companyWide ? "Painel de RH" : "Acompanhamento da equipe"}
        </h1>
        <p className="text-sm text-slate-500">
          {companyWide
            ? "Visão da empresa e por equipe (inclui subequipes). Só leitura."
            : "Acompanhe o desenvolvimento do seu time. Você vê apenas o seu escopo."}
        </p>
      </div>

      {/* Tiles do escopo */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label={`${scopeLabel} · pessoas`} value={scope.pessoas} />
        <Tile label="Em treinamento" value={`${scope.adesao}%`} sub={`${scope.emTreino} com matrícula`} />
        <Tile label="Conclusão" value={`${scope.conclusao}%`} sub={`${scope.concluidos}/${scope.matriculas} matrículas`} />
        <Tile label="Certificados" value={scope.certs} />
      </div>

      {/* RH / admin: empresa toda */}
      {companyWide && (
        <div className="card mt-6">
          <h2 className="mb-4 font-semibold">Por equipe</h2>
          {data.teams.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma equipe cadastrada ainda.</p>
          ) : (
            <TeamCockpit data={data} roots={data.roots} mode="tree" />
          )}
        </div>
      )}

      {/* Gestor: própria equipe + subárvore (drill-down) */}
      {!companyWide && managerTeams.length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-1 font-semibold">Como gestor</h2>
          <p className="mb-4 text-xs text-slate-500">
            Sua equipe e todas as subequipes. Abra “Pessoas nesta equipe” para o
            progresso individual; desça a árvore para chegar em cada supervisor.
          </p>
          <TeamCockpit data={data} roots={managerTeams} mode="tree" />
        </div>
      )}

      {/* Supervisor: apenas a própria equipe */}
      {!companyWide && supervisorTeams.length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-1 font-semibold">Como supervisor</h2>
          <p className="mb-4 text-xs text-slate-500">
            Apenas a(s) sua(s) equipe(s) — o progresso individual de cada pessoa.
          </p>
          <TeamCockpit data={data} roots={supervisorTeams} mode="direct" />
        </div>
      )}
    </AppShell>
  );
}

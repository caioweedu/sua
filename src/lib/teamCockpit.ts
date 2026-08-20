import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { loadAnalytics } from "./analytics";

// Onda 3 · F1/F2 — dados do cockpit de RH/gestor: métricas por aluno (reusando
// o analytics) organizadas pela árvore de equipes (Team/User.teamId da F0).
// Puro de dados; a renderização fica nas páginas (admin/rh e minha-equipe).

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  enrolled: number;
  completed: number;
  aulasDone: number;
  examsPassed: number;
  certificates: number;
};

export type TeamNode = { id: string; name: string; parentId: string | null };

export type TeamAgg = {
  pessoas: number;
  emTreino: number;
  matriculas: number;
  concluidos: number;
  aulas: number;
  provas: number;
  certs: number;
  adesao: number; // % de pessoas com ao menos uma matrícula
  conclusao: number; // % de matrículas concluídas
};

export type TeamCockpitData = {
  overview: Awaited<ReturnType<typeof loadAnalytics>>["overview"];
  cert30: number;
  teams: TeamNode[];
  byId: Map<string, MemberRow>;
  directMembers: Map<string, string[]>; // teamId -> ids de alunos diretos
  childrenOf: Map<string | null, TeamNode[]>; // parentId -> filhos
  roots: TeamNode[];
  noTeam: string[]; // alunos sem equipe
  allStudentIds: string[];
};

export async function loadTeamCockpitData(
  tenantId: string,
  trilhaWhere: Prisma.TrilhaWhereInput
): Promise<TeamCockpitData> {
  const [analytics, teams, studentTeams] = await Promise.all([
    loadAnalytics(tenantId, trilhaWhere),
    prisma.team.findMany({
      where: { tenantId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, parentId: true },
    }),
    prisma.user.findMany({
      where: { tenantId, role: "STUDENT" },
      select: { id: true, teamId: true },
    }),
  ]);

  const byId = new Map<string, MemberRow>(analytics.perStudent.map((s) => [s.id, s]));

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

  const childrenOf = new Map<string | null, TeamNode[]>();
  for (const t of teams) {
    const key = t.parentId ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(t);
  }

  return {
    overview: analytics.overview,
    cert30: analytics.engagement.cert30,
    teams,
    byId,
    directMembers,
    childrenOf,
    roots: childrenOf.get(null) ?? [],
    noTeam,
    allStudentIds: studentTeams.map((s) => s.id),
  };
}

// IDs de alunos de uma equipe INCLUINDO subequipes (rollup na árvore).
export function subtreeMemberIds(
  teamId: string,
  data: Pick<TeamCockpitData, "directMembers" | "childrenOf">
): string[] {
  const ids = [...(data.directMembers.get(teamId) ?? [])];
  for (const c of data.childrenOf.get(teamId) ?? []) {
    ids.push(...subtreeMemberIds(c.id, data));
  }
  return ids;
}

// Conjunto de pessoas que um papel/liderança pode ver (mesma regra do painel
// /minha-equipe): RH/admin veem a empresa toda; gestor vê a subárvore das suas
// equipes; supervisor vê só os membros diretos das suas. Serve para os tiles do
// painel E para autorizar o acesso à ficha individual de cada pessoa.
export function visibleMemberIds(
  data: TeamCockpitData,
  opts: { companyWide: boolean; managerTeamIds: string[]; supervisorTeamIds: string[] }
): Set<string> {
  const ids = new Set<string>();
  if (opts.companyWide) {
    for (const id of data.allStudentIds) ids.add(id);
    return ids;
  }
  for (const tid of opts.managerTeamIds) for (const id of subtreeMemberIds(tid, data)) ids.add(id);
  for (const tid of opts.supervisorTeamIds) for (const id of data.directMembers.get(tid) ?? []) ids.add(id);
  return ids;
}

// Agrega as métricas de uma lista de alunos.
export function aggMembers(ids: string[], byId: Map<string, MemberRow>): TeamAgg {
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

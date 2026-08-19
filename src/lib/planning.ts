import "server-only";
import { prisma } from "./db";

// Onda 3 · F3b — visão geral do planejamento por colaborador (para o painel de
// RH): quantos treinamentos planejados, atrasados e pendentes por pessoa, para
// alertar RH/gestores. Batch (poucas consultas), escopado ao tenant.

export type PlanningRow = {
  id: string;
  name: string;
  email: string;
  total: number;
  overdue: number;
  pending: number; // não concluídos (inclui atrasados)
  done: number;
};

export async function loadPlanningOverview(
  tenantId: string,
  contentIds: string[]
): Promise<PlanningRow[]> {
  const [students, assignments, completed] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "STUDENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, teamId: true },
    }),
    prisma.trainingAssignment.findMany({
      where: { tenantId, trilha: { published: true, tenantId: { in: contentIds } } },
      select: { trilhaId: true, userId: true, teamId: true, dueDate: true },
    }),
    prisma.enrollment.findMany({
      where: { status: "COMPLETED", user: { tenantId } },
      select: { userId: true, trilhaId: true },
    }),
  ]);

  const completedSet = new Set(completed.map((e) => `${e.userId}:${e.trilhaId}`));
  const now = new Date();

  // Índices de atribuição: por usuário e por equipe.
  const byUser = new Map<string, typeof assignments>();
  const byTeam = new Map<string, typeof assignments>();
  for (const a of assignments) {
    if (a.userId) {
      if (!byUser.has(a.userId)) byUser.set(a.userId, []);
      byUser.get(a.userId)!.push(a);
    } else if (a.teamId) {
      if (!byTeam.has(a.teamId)) byTeam.set(a.teamId, []);
      byTeam.get(a.teamId)!.push(a);
    }
  }

  return students
    .map((s) => {
      // Planejado = atribuições diretas + da equipe; menor prazo por produto.
      const dueByTrilha = new Map<string, Date | null>();
      const consider = [
        ...(byUser.get(s.id) ?? []),
        ...(s.teamId ? byTeam.get(s.teamId) ?? [] : []),
      ];
      for (const a of consider) {
        if (!dueByTrilha.has(a.trilhaId)) {
          dueByTrilha.set(a.trilhaId, a.dueDate ?? null);
        } else {
          const prev = dueByTrilha.get(a.trilhaId)!;
          if (a.dueDate && (!prev || a.dueDate < prev)) dueByTrilha.set(a.trilhaId, a.dueDate);
        }
      }

      let overdue = 0, pending = 0, done = 0;
      for (const [trilhaId, due] of dueByTrilha) {
        const isDone = completedSet.has(`${s.id}:${trilhaId}`);
        if (isDone) {
          done++;
        } else {
          pending++;
          if (due && due < now) overdue++;
        }
      }
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        total: dueByTrilha.size,
        overdue,
        pending,
        done,
      };
    })
    .sort((a, b) => b.overdue - a.overdue || b.pending - a.pending || a.name.localeCompare(b.name));
}

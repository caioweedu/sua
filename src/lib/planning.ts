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
  const [students, assignments, completed, extDoneRows] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "STUDENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, teamId: true },
    }),
    prisma.trainingAssignment.findMany({
      where: {
        tenantId,
        OR: [
          { kind: { not: "EXTERNAL" }, trilha: { published: true, tenantId: { in: contentIds } } },
          { kind: "EXTERNAL" },
        ],
      },
      select: { id: true, kind: true, trilhaId: true, userId: true, teamId: true, dueDate: true },
    }),
    prisma.enrollment.findMany({
      where: { status: "COMPLETED", user: { tenantId } },
      select: { userId: true, trilhaId: true },
    }),
    prisma.externalCompletion.findMany({
      where: { assignment: { tenantId } },
      select: { assignmentId: true, userId: true },
    }),
  ]);

  const completedSet = new Set(completed.map((e) => `${e.userId}:${e.trilhaId}`));
  const extDone = new Set(extDoneRows.map((e) => `${e.userId}:${e.assignmentId}`));
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
      // Planejado = atribuições diretas + da equipe; online deduplica por produto
      // (menor prazo); externo é uma linha por atribuição.
      const items = new Map<string, { due: Date | null; compKey: string }>();
      const consider = [
        ...(byUser.get(s.id) ?? []),
        ...(s.teamId ? byTeam.get(s.teamId) ?? [] : []),
      ];
      for (const a of consider) {
        const external = a.kind === "EXTERNAL";
        const refKey = external ? `x:${a.id}` : `t:${a.trilhaId}`;
        const compKey = external ? `${s.id}:${a.id}` : `${s.id}:${a.trilhaId}`;
        const prev = items.get(refKey);
        if (!prev) {
          items.set(refKey, { due: a.dueDate ?? null, compKey });
        } else if (a.dueDate && (!prev.due || a.dueDate < prev.due)) {
          items.set(refKey, { ...prev, due: a.dueDate });
        }
      }

      let overdue = 0, pending = 0, done = 0;
      for (const [refKey, it] of items) {
        const isDone = refKey.startsWith("x:") ? extDone.has(it.compKey) : completedSet.has(it.compKey);
        const due = it.due;
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
        total: items.size,
        overdue,
        pending,
        done,
      };
    })
    .sort((a, b) => b.overdue - a.overdue || b.pending - a.pending || a.name.localeCompare(b.name));
}

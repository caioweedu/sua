import "server-only";
import { prisma } from "./db";
import { WARN_DAYS } from "./compliance";

// Onda 3 · F3 — resolve a "agenda de treinamentos" de um aluno: atribuições
// diretas (userId) + as da equipe dele (teamId), com progresso e prazo.

export type AgendaItem = {
  assignmentId: string;
  trilhaId: string;
  title: string;
  startDate: Date | null;
  dueDate: Date | null;
  required: boolean;
  recurrenceMonths: number | null; // validade em meses (recorrente); null = uma vez
  source: "you" | "team"; // atribuição direta ou herdada da equipe
  aulasTotal: number;
  aulasDone: number;
  progressPct: number;
  completed: boolean;
  overdue: boolean;
  // Recorrência (compliance): quando um obrigatório recorrente concluído vence.
  expiresAt: Date | null; // nulo = não recorrente, ou sem data de conclusão
  expired: boolean; // já venceu — precisa refazer
  expiringSoon: boolean; // vence dentro de WARN_DAYS dias
};

function addMonths(d: Date, m: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

export async function loadUserAgenda(
  userId: string,
  tenantId: string,
  teamId: string | null,
  contentIds: string[]
): Promise<AgendaItem[]> {
  const assignments = await prisma.trainingAssignment.findMany({
    where: {
      tenantId,
      OR: [{ userId }, ...(teamId ? [{ teamId }] : [])],
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: {
      trilha: {
        select: {
          id: true,
          title: true,
          published: true,
          tenantId: true,
          aulas: { select: { id: true } },
        },
      },
    },
  });

  // Só produtos publicados e dentro do escopo de conteúdo do tenant.
  const valid = assignments.filter(
    (a) => a.trilha.published && contentIds.includes(a.trilha.tenantId)
  );
  if (valid.length === 0) return [];

  const trilhaIds = [...new Set(valid.map((a) => a.trilhaId))];
  const [progress, enrollments] = await Promise.all([
    prisma.aulaProgress.findMany({ where: { userId }, select: { aulaId: true } }),
    prisma.enrollment.findMany({
      where: { userId, trilhaId: { in: trilhaIds } },
      select: { trilhaId: true, status: true, completedAt: true },
    }),
  ]);
  const doneAulas = new Set(progress.map((p) => p.aulaId));
  const completedTrilha = new Set(
    enrollments.filter((e) => e.status === "COMPLETED").map((e) => e.trilhaId)
  );
  // Data de conclusão por produto (base do vencimento dos recorrentes).
  const completedAtByTrilha = new Map(
    enrollments.filter((e) => e.status === "COMPLETED").map((e) => [e.trilhaId, e.completedAt])
  );

  const now = new Date();
  // Uma linha por produto: a atribuição direta tem prioridade sobre a da equipe;
  // mantém o menor prazo e "obrigatório" se qualquer origem for obrigatória.
  const byTrilha = new Map<string, AgendaItem>();
  for (const a of valid) {
    const t = a.trilha;
    const total = t.aulas.length;
    const done = t.aulas.filter((x) => doneAulas.has(x.id)).length;
    const completed = completedTrilha.has(t.id) || (total > 0 && done === total);
    const source: "you" | "team" = a.userId ? "you" : "team";

    const prev = byTrilha.get(t.id);
    const dueDate =
      prev?.dueDate && a.dueDate
        ? prev.dueDate < a.dueDate
          ? prev.dueDate
          : a.dueDate
        : prev?.dueDate ?? a.dueDate ?? null;

    // Vencimento (recorrência): só quando concluído, recorrente e com data.
    const recurrenceMonths = prev?.recurrenceMonths ?? a.recurrenceMonths ?? null;
    const doneAt = completedAtByTrilha.get(t.id) ?? null;
    const expiresAt =
      completed && recurrenceMonths && recurrenceMonths > 0 && doneAt
        ? addMonths(doneAt, recurrenceMonths)
        : null;
    const expired = !!expiresAt && expiresAt < now;
    const expiringSoon =
      !!expiresAt && !expired && expiresAt.getTime() - now.getTime() <= WARN_DAYS * 864e5;

    const item: AgendaItem = {
      assignmentId: source === "you" ? a.id : prev?.assignmentId ?? a.id,
      trilhaId: t.id,
      title: t.title,
      startDate: prev?.startDate ?? a.startDate ?? null,
      dueDate,
      required: (prev?.required ?? false) || a.required,
      recurrenceMonths,
      source: prev?.source === "you" ? "you" : source,
      aulasTotal: total,
      aulasDone: done,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
      completed,
      overdue: !completed && !!dueDate && dueDate < now,
      expiresAt,
      expired,
      expiringSoon,
    };
    byTrilha.set(t.id, item);
  }

  // Ordena: pendências de ação primeiro (atrasado ou vencido), depois por prazo,
  // depois sem prazo, por título.
  return [...byTrilha.values()].sort((a, b) => {
    const aAct = a.overdue || a.expired;
    const bAct = b.overdue || b.expired;
    if (aAct !== bAct) return aAct ? -1 : 1;
    if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    return a.title.localeCompare(b.title);
  });
}

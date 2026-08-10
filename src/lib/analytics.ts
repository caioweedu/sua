import "server-only";
import { prisma } from "./db";

// Agrega as métricas do painel de resultados (Fase 7), tudo escopado ao tenant.
// Uma única leva de consultas em paralelo para manter a página rápida.
export async function loadAnalytics(tenantId: string) {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 864e5);
  const d14 = new Date(now.getTime() - 14 * 864e5);

  const [
    totalStudents,
    enrollByStatus,
    totalCertificates,
    trilhas,
    completedByTrilha,
    attempts,
    enrollByUser,
    completedByUser,
    certByUser,
    aulasByUser,
    passedByUser,
    students,
    newEnroll30,
    aulas30,
    cert30,
    aulasRecent,
  ] = await Promise.all([
    prisma.user.count({ where: { tenantId, role: "STUDENT" } }),
    prisma.enrollment.groupBy({ by: ["status"], where: { user: { tenantId } }, _count: { _all: true } }),
    prisma.certificate.count({ where: { trilha: { tenantId } } }),
    prisma.trilha.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, published: true, _count: { select: { enrollments: true } } },
    }),
    prisma.enrollment.groupBy({
      by: ["trilhaId"],
      where: { user: { tenantId }, status: "COMPLETED" },
      _count: { _all: true },
    }),
    // Tentativas de prova com o produto de contexto (colocação em trilha ou módulo).
    prisma.examAttempt.findMany({
      where: { user: { tenantId } },
      select: {
        userId: true,
        passed: true,
        placement: { select: { trilhaId: true, modulo: { select: { trilhaId: true } } } },
      },
    }),
    prisma.enrollment.groupBy({ by: ["userId"], where: { user: { tenantId } }, _count: { _all: true } }),
    prisma.enrollment.groupBy({ by: ["userId"], where: { user: { tenantId }, status: "COMPLETED" }, _count: { _all: true } }),
    prisma.certificate.groupBy({ by: ["userId"], where: { trilha: { tenantId } }, _count: { _all: true } }),
    prisma.aulaProgress.groupBy({ by: ["userId"], where: { user: { tenantId } }, _count: { _all: true } }),
    prisma.examAttempt.groupBy({ by: ["userId"], where: { user: { tenantId }, passed: true }, _count: { _all: true } }),
    prisma.user.findMany({
      where: { tenantId, role: "STUDENT" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.enrollment.count({ where: { user: { tenantId }, createdAt: { gte: d30 } } }),
    prisma.aulaProgress.count({ where: { user: { tenantId }, completedAt: { gte: d30 } } }),
    prisma.certificate.count({ where: { trilha: { tenantId }, issuedAt: { gte: d30 } } }),
    prisma.aulaProgress.findMany({
      where: { user: { tenantId }, completedAt: { gte: d14 } },
      select: { completedAt: true },
    }),
  ]);

  const totalEnroll = enrollByStatus.reduce((s, r) => s + r._count._all, 0);
  const completedEnroll = enrollByStatus.find((r) => r.status === "COMPLETED")?._count._all ?? 0;
  const activeEnroll = totalEnroll - completedEnroll;
  const completionRate = totalEnroll > 0 ? Math.round((completedEnroll / totalEnroll) * 100) : 0;

  const completedMap = new Map(completedByTrilha.map((r) => [r.trilhaId, r._count._all]));

  // Aprovação por trilha (alunos distintos aprovados / que tentaram).
  const attemptedByTrilha = new Map<string, Set<string>>();
  const passedByTrilha = new Map<string, Set<string>>();
  for (const a of attempts) {
    const tid = a.placement?.trilhaId ?? a.placement?.modulo?.trilhaId ?? null;
    if (!tid) continue;
    if (!attemptedByTrilha.has(tid)) attemptedByTrilha.set(tid, new Set());
    attemptedByTrilha.get(tid)!.add(a.userId);
    if (a.passed) {
      if (!passedByTrilha.has(tid)) passedByTrilha.set(tid, new Set());
      passedByTrilha.get(tid)!.add(a.userId);
    }
  }

  const perTrilha = trilhas.map((t) => {
    const enrolled = t._count.enrollments;
    const completed = completedMap.get(t.id) ?? 0;
    const attempted = attemptedByTrilha.get(t.id)?.size ?? 0;
    const passed = passedByTrilha.get(t.id)?.size ?? 0;
    return {
      id: t.id,
      title: t.title,
      published: t.published,
      enrolled,
      completed,
      completionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
      attempted,
      passed,
      approvalRate: attempted > 0 ? Math.round((passed / attempted) * 100) : 0,
    };
  });

  const enrollUserMap = new Map(enrollByUser.map((r) => [r.userId, r._count._all]));
  const completedUserMap = new Map(completedByUser.map((r) => [r.userId, r._count._all]));
  const certUserMap = new Map(certByUser.map((r) => [r.userId, r._count._all]));
  const aulasUserMap = new Map(aulasByUser.map((r) => [r.userId, r._count._all]));
  const passedUserMap = new Map(passedByUser.map((r) => [r.userId, r._count._all]));

  const perStudent = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    enrolled: enrollUserMap.get(s.id) ?? 0,
    completed: completedUserMap.get(s.id) ?? 0,
    aulasDone: aulasUserMap.get(s.id) ?? 0,
    examsPassed: passedUserMap.get(s.id) ?? 0,
    certificates: certUserMap.get(s.id) ?? 0,
  }));

  // Série diária (últimos 14 dias) de aulas concluídas, para o mini gráfico.
  const days: { label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 864e5);
    const key = day.toISOString().slice(0, 10);
    const count = aulasRecent.filter((a) => a.completedAt.toISOString().slice(0, 10) === key).length;
    days.push({ label: `${day.getDate()}/${day.getMonth() + 1}`, count });
  }

  return {
    overview: {
      totalStudents,
      totalEnroll,
      activeEnroll,
      completedEnroll,
      completionRate,
      totalCertificates,
    },
    engagement: { newEnroll30, aulas30, cert30, days },
    perTrilha,
    perStudent,
  };
}

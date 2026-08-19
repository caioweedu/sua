import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

// Agrega as métricas do painel de resultados (Fase 7), tudo escopado ao tenant.
// Uma única leva de consultas em paralelo para manter a página rápida.
export async function loadAnalytics(
  tenantId: string,
  trilhaWhere: Prisma.TrilhaWhereInput = { tenantId }
) {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 864e5);
  const d14 = new Date(now.getTime() - 14 * 864e5);

  // Filtros escopados: só alunos DESTE tenant E só os produtos visíveis a ele
  // (próprios + liberados pela mãe). Assim os totais do topo, engajamento e o
  // "por aluno" batem com a tabela "por produto", mesmo se um conteúdo tiver
  // sido liberado e depois retirado.
  const enrollWhere: Prisma.EnrollmentWhereInput = {
    user: { tenantId },
    trilha: trilhaWhere,
  };
  const aulaWhere: Prisma.AulaProgressWhereInput = {
    user: { tenantId },
    aula: { trilha: trilhaWhere },
  };
  const certWhere: Prisma.CertificateWhereInput = {
    user: { tenantId },
    trilha: trilhaWhere,
  };
  const attemptWhere: Prisma.ExamAttemptWhereInput = {
    user: { tenantId },
    placement: {
      OR: [{ trilha: trilhaWhere }, { modulo: { trilha: trilhaWhere } }],
    },
  };

  const [
    totalStudents,
    enrollByStatus,
    totalCertificates,
    trilhas,
    completedByTrilha,
    enrolledByTrilha,
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
    prisma.enrollment.groupBy({ by: ["status"], where: enrollWhere, _count: { _all: true } }),
    prisma.certificate.count({ where: certWhere }),
    // Produtos visíveis a este tenant (próprios + liberados da mãe).
    prisma.trilha.findMany({
      where: trilhaWhere,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, published: true },
    }),
    prisma.enrollment.groupBy({
      by: ["trilhaId"],
      where: { ...enrollWhere, status: "COMPLETED" },
      _count: { _all: true },
    }),
    // Matriculados por produto — só alunos DESTE tenant (numa filha, não conta
    // alunos de outras filhas/mãe matriculados no mesmo produto compartilhado).
    prisma.enrollment.groupBy({
      by: ["trilhaId"],
      where: enrollWhere,
      _count: { _all: true },
    }),
    // Tentativas de prova com o produto de contexto (colocação em trilha ou módulo).
    prisma.examAttempt.findMany({
      where: attemptWhere,
      select: {
        userId: true,
        passed: true,
        placement: { select: { trilhaId: true, modulo: { select: { trilhaId: true } } } },
      },
    }),
    prisma.enrollment.groupBy({ by: ["userId"], where: enrollWhere, _count: { _all: true } }),
    prisma.enrollment.groupBy({ by: ["userId"], where: { ...enrollWhere, status: "COMPLETED" }, _count: { _all: true } }),
    prisma.certificate.groupBy({ by: ["userId"], where: certWhere, _count: { _all: true } }),
    prisma.aulaProgress.groupBy({ by: ["userId"], where: aulaWhere, _count: { _all: true } }),
    prisma.examAttempt.groupBy({ by: ["userId"], where: { ...attemptWhere, passed: true }, _count: { _all: true } }),
    prisma.user.findMany({
      where: { tenantId, role: "STUDENT" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.enrollment.count({ where: { ...enrollWhere, createdAt: { gte: d30 } } }),
    prisma.aulaProgress.count({ where: { ...aulaWhere, completedAt: { gte: d30 } } }),
    prisma.certificate.count({ where: { ...certWhere, issuedAt: { gte: d30 } } }),
    prisma.aulaProgress.findMany({
      where: { ...aulaWhere, completedAt: { gte: d14 } },
      select: { completedAt: true },
    }),
  ]);

  const totalEnroll = enrollByStatus.reduce((s, r) => s + r._count._all, 0);
  const completedEnroll = enrollByStatus.find((r) => r.status === "COMPLETED")?._count._all ?? 0;
  const activeEnroll = totalEnroll - completedEnroll;
  const completionRate = totalEnroll > 0 ? Math.round((completedEnroll / totalEnroll) * 100) : 0;

  const completedMap = new Map(completedByTrilha.map((r) => [r.trilhaId, r._count._all]));
  const enrolledMap = new Map(enrolledByTrilha.map((r) => [r.trilhaId, r._count._all]));

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
    const enrolled = enrolledMap.get(t.id) ?? 0;
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

// Detalhe de um aluno (Fase 8): cursos matriculados/concluídos, progresso de
// aulas, tempo até concluir, melhor nota nas provas e certificados. Tudo
// escopado ao tenant. Retorna null se o aluno não existe no tenant.
export async function loadStudentDetail(
  tenantId: string,
  userId: string,
  contentIds: string[] = [tenantId]
) {
  const student = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: { in: ["STUDENT", "HR"] } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      active: true,
      createdAt: true,
      accessProfile: { select: { name: true } },
    },
  });
  if (!student) return null;

  const [enrollments, progress, attempts, certs] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, trilha: { tenantId: { in: contentIds } } },
      orderBy: { createdAt: "asc" },
      select: {
        status: true,
        createdAt: true,
        trilha: { select: { id: true, title: true, aulas: { select: { id: true } } } },
      },
    }),
    prisma.aulaProgress.findMany({
      where: { userId },
      select: { aulaId: true, completedAt: true },
    }),
    prisma.examAttempt.findMany({
      where: { userId },
      select: {
        score: true,
        passed: true,
        placement: { select: { trilhaId: true, modulo: { select: { trilhaId: true } } } },
      },
    }),
    prisma.certificate.findMany({
      where: { userId, trilha: { tenantId: { in: contentIds } } },
      select: { trilhaId: true, issuedAt: true, code: true },
    }),
  ]);

  const doneAt = new Map(progress.map((p) => [p.aulaId, p.completedAt]));
  const certByTrilha = new Map(certs.map((c) => [c.trilhaId, c]));

  // Melhor nota (e aprovação) por produto de contexto da prova.
  const bestScore = new Map<string, number>();
  const passedTrilha = new Set<string>();
  for (const at of attempts) {
    const tid = at.placement?.trilhaId ?? at.placement?.modulo?.trilhaId ?? null;
    if (!tid) continue;
    bestScore.set(tid, Math.max(bestScore.get(tid) ?? 0, at.score));
    if (at.passed) passedTrilha.add(tid);
  }

  const DAY = 864e5;
  const courses = enrollments.map((e) => {
    const aulaIds = e.trilha.aulas.map((a) => a.id);
    const done = aulaIds.filter((id) => doneAt.has(id));
    const total = aulaIds.length;
    const progressPct = total > 0 ? Math.round((done.length / total) * 100) : 0;

    // Última aula concluída deste produto (para estimar tempo de conclusão).
    let lastCompleted: Date | null = null;
    for (const id of done) {
      const d = doneAt.get(id)!;
      if (!lastCompleted || d > lastCompleted) lastCompleted = d;
    }
    const cert = certByTrilha.get(e.trilha.id) ?? null;
    const endDate = cert?.issuedAt ?? (e.status === "COMPLETED" ? lastCompleted : null);
    const completionDays = endDate
      ? Math.max(0, Math.round((endDate.getTime() - e.createdAt.getTime()) / DAY))
      : null;

    return {
      id: e.trilha.id,
      title: e.trilha.title,
      status: e.status,
      enrolledAt: e.createdAt,
      aulasTotal: total,
      aulasDone: done.length,
      progressPct,
      bestScore: bestScore.has(e.trilha.id) ? bestScore.get(e.trilha.id)! : null,
      passed: passedTrilha.has(e.trilha.id),
      certCode: cert?.code ?? null,
      certIssuedAt: cert?.issuedAt ?? null,
      completionDays,
    };
  });

  const scores = courses.map((c) => c.bestScore).filter((s): s is number => s != null);
  const totals = {
    enrolled: enrollments.length,
    completed: enrollments.filter((e) => e.status === "COMPLETED").length,
    aulasDone: progress.length,
    certificates: certs.length,
    avgScore: scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null,
  };

  return { student, totals, courses };
}

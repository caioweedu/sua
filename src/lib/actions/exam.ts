"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { issueCertificateForPlacement } from "@/lib/certificate";
import { awardXp } from "@/lib/gamification";
import { evaluateBadges } from "@/lib/badges";
import { contentTenantIds } from "@/lib/access";

export type GradeResult = {
  ok: boolean;
  score: number;
  passed: boolean;
  passingScore: number;
  certificateCode?: string;
  // Quando a prova permite mostrar o gabarito, devolvemos o detalhamento
  // (correta x escolhida) para a revisão ao final.
  showAnswers?: boolean;
  details?: {
    questionId: string;
    correctOptionId: string;
    selectedOptionId: string;
  }[];
  error?: string;
};

// Corrige a prova de uma COLOCAÇÃO (placement). Recebe os IDs das questões
// sorteadas/apresentadas e a alternativa escolhida em cada uma. A correção usa
// sempre o gabarito do banco — o cliente nunca decide o que é certo.
//
// Fase 1: o certificado é emitido apenas quando a prova está colocada no
// produto (placement.trilhaId, sem módulo/vitrine). Provas de módulo e de
// vitrine registram a tentativa/aprovação, mas a emissão condicionada de
// certificado é tratada na Fase 3 (certificado como colocação).
export async function gradeExam(
  placementId: string,
  answers: { questionId: string; optionId: string }[]
): Promise<GradeResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, score: 0, passed: false, passingScore: 0, error: "Sessão expirada." };

  const placement = await prisma.examPlacement.findUnique({
    where: { id: placementId },
    include: { exam: true, trilha: { select: { id: true, title: true } } },
  });
  // O aluno pode fazer provas do próprio tenant OU herdadas da mãe (white-label).
  // Igualdade estrita quebrava provas da mãe usadas por alunos da filha.
  if (!placement || !contentTenantIds(user.tenant).includes(placement.exam.tenantId)) {
    return { ok: false, score: 0, passed: false, passingScore: 0, error: "Prova não encontrada." };
  }
  const exam = placement.exam;

  const questionIds = answers.map((a) => a.questionId);
  const correctOptions = await prisma.questionOption.findMany({
    where: { questionId: { in: questionIds }, isCorrect: true },
    select: { questionId: true, id: true },
  });
  const correctByQuestion = new Map(correctOptions.map((o) => [o.questionId, o.id]));

  const total = answers.length;
  const hits = answers.filter(
    (a) => correctByQuestion.get(a.questionId) === a.optionId
  ).length;
  const score = total > 0 ? Math.round((hits / total) * 100) : 0;
  const passed = score >= exam.passingScore;

  await prisma.examAttempt.create({
    data: {
      userId: user.id,
      examId: exam.id,
      placementId: placement.id,
      score,
      passed,
      answers: JSON.stringify(answers),
    },
  });

  // Gamificação: XP por aprovação na prova (idempotente por exame).
  if (passed) {
    await awardXp(user.id, user.tenantId, "PROVA_APROVADA", exam.id);
  }

  let certificateCode: string | undefined;

  // Emissão de certificado só para prova final do produto (Fase 1).
  const isProdutoExam = !!placement.trilha && !placement.moduloId && !placement.vitrineId;

  if (passed && isProdutoExam && placement.trilha) {
    const trilhaId = placement.trilha.id;
    // Marca a trilha como concluída.
    await prisma.enrollment.upsert({
      where: { userId_trilhaId: { userId: user.id, trilhaId } },
      update: { status: "COMPLETED" },
      create: { userId: user.id, trilhaId, status: "COMPLETED" },
    });

    // Já emitido? devolve o código.
    const existing = await prisma.certificate.findFirst({
      where: { userId: user.id, trilhaId },
    });
    if (existing) {
      certificateCode = existing.code;
    } else {
      // Certificado como item inserível (Fase 3): se o produto tem uma
      // colocação de certificado, emite por ela (respeitando a condição).
      const certPlacement = await prisma.certificatePlacement.findFirst({
        where: { trilhaId },
        select: { id: true },
      });
      if (certPlacement) {
        const res = await issueCertificateForPlacement(user.id, certPlacement.id);
        if ("code" in res) certificateCode = res.code;
        // Se a condição ainda não foi satisfeita, o aluno emite depois na trilha.
      } else {
        // Legado: emite o certificado padrão do produto ao passar na prova.
        const code =
          randomUUID().split("-")[0].toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
        const cert = await prisma.certificate.create({
          data: {
            code,
            userId: user.id,
            trilhaId,
            studentName: user.name,
            trilhaTitle: placement.trilha.title,
          },
        });
        certificateCode = cert.code;
      }
    }

    // Gamificação: XP por certificado (idempotente por trilha).
    if (certificateCode) {
      await awardXp(user.id, user.tenantId, "CERTIFICADO", trilhaId);
    }
  }

  // Gamificação: reavalia conquistas (nota máxima, trilhas concluídas, nível).
  if (passed) {
    await evaluateBadges(user.id, user.tenantId);
  }

  return {
    ok: true,
    score,
    passed,
    passingScore: exam.passingScore,
    certificateCode,
    showAnswers: exam.showAnswers,
    details: exam.showAnswers
      ? answers.map((a) => ({
          questionId: a.questionId,
          correctOptionId: correctByQuestion.get(a.questionId) ?? "",
          selectedOptionId: a.optionId,
        }))
      : undefined,
  };
}

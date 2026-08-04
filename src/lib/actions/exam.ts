"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

// Corrige a prova. Recebe os IDs das questões que foram sorteadas/apresentadas
// e a alternativa escolhida em cada uma. A correção usa sempre o gabarito do
// banco — o cliente nunca decide o que é certo.
export async function gradeExam(
  examId: string,
  answers: { questionId: string; optionId: string }[]
): Promise<GradeResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, score: 0, passed: false, passingScore: 0, error: "Sessão expirada." };

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { trilha: true },
  });
  if (!exam || exam.trilha.tenantId !== user.tenantId) {
    return { ok: false, score: 0, passed: false, passingScore: 0, error: "Prova não encontrada." };
  }

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
      score,
      passed,
      answers: JSON.stringify(answers),
    },
  });

  let certificateCode: string | undefined;

  if (passed) {
    // Marca a trilha como concluída.
    await prisma.enrollment.upsert({
      where: { userId_trilhaId: { userId: user.id, trilhaId: exam.trilhaId } },
      update: { status: "COMPLETED" },
      create: { userId: user.id, trilhaId: exam.trilhaId, status: "COMPLETED" },
    });

    // Emite certificado (uma vez por aluno/trilha).
    const existing = await prisma.certificate.findFirst({
      where: { userId: user.id, trilhaId: exam.trilhaId },
    });
    if (existing) {
      certificateCode = existing.code;
    } else {
      const code = randomUUID().split("-")[0].toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
      const cert = await prisma.certificate.create({
        data: {
          code,
          userId: user.id,
          trilhaId: exam.trilhaId,
          studentName: user.name,
          trilhaTitle: exam.trilha.title,
        },
      });
      certificateCode = cert.code;
    }
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

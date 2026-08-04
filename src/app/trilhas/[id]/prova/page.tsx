import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds, canAccessVitrine } from "@/lib/access";
import { completedAulaIds, completedTrilhaIds, lockReason } from "@/lib/progress";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import ExamRunner from "./exam-runner";

// Embaralha um array (Fisher-Yates).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function ProvaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trilha = await prisma.trilha.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      exam: { include: { questions: { include: { options: true } } } },
      _count: { select: { aulas: true } },
    },
  });
  if (!trilha || !trilha.exam) notFound();

  // Respeita o perfil de acesso do aluno.
  const allowed = await allowedVitrineIds(user);
  if (!canAccessVitrine(allowed, trilha.vitrineId)) notFound();

  const exam = trilha.exam;

  // Gate de liberação (B2): pré-requisito e conclusão de todas as aulas.
  if (user.role === "STUDENT") {
    const completedTrilhas = await completedTrilhaIds(user.id);
    if (lockReason(trilha.prereqTrilhaId, null, completedTrilhas)) {
      redirect(`/trilhas/${trilha.id}`);
    }
    if (exam.requireAllLessons && trilha._count.aulas > 0) {
      const done = await completedAulaIds(user.id, trilha.id);
      if (done.size < trilha._count.aulas) {
        // Ainda não concluiu todas as aulas — volta para a trilha.
        redirect(`/trilhas/${trilha.id}`);
      }
    }
  }

  // Se já tem certificado, não refaz a prova.
  const cert = await prisma.certificate.findFirst({
    where: { userId: user.id, trilhaId: trilha.id },
  });
  if (cert) redirect(`/certificados/${cert.code}`);

  // SORTEIO: pega `questionsToShow` questões aleatórias do banco cadastrado.
  // As alternativas só são embaralhadas se o admin habilitar essa opção.
  const sampled = shuffle(exam.questions)
    .slice(0, exam.questionsToShow)
    .map((q) => ({
      id: q.id,
      statement: q.statement,
      options: (exam.shuffleOptions ? shuffle(q.options) : q.options).map((o) => ({
        id: o.id,
        text: o.text,
      })),
    }));

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">{exam.title}</h1>
        <p className="mb-6 text-slate-500">
          {trilha.title} · {sampled.length} questões · {exam.passingScore}% para
          aprovação
        </p>
        <ExamRunner examId={exam.id} questions={sampled} />
      </div>
    </AppShell>
  );
}

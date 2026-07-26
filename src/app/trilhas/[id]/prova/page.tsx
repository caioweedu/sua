import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
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
    },
  });
  if (!trilha || !trilha.exam) notFound();

  const exam = trilha.exam;

  // Se já tem certificado, não refaz a prova.
  const cert = await prisma.certificate.findFirst({
    where: { userId: user.id, trilhaId: trilha.id },
  });
  if (cert) redirect(`/certificados/${cert.code}`);

  // SORTEIO: pega `questionsToShow` questões aleatórias do banco cadastrado
  // e embaralha as alternativas de cada uma.
  const sampled = shuffle(exam.questions)
    .slice(0, exam.questionsToShow)
    .map((q) => ({
      id: q.id,
      statement: q.statement,
      options: shuffle(q.options).map((o) => ({ id: o.id, text: o.text })),
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

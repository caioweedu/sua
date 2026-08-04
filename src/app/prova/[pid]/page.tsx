import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds, canAccessVitrine } from "@/lib/access";
import { loadProgress, isUnlocked } from "@/lib/release";
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

// Prova de uma COLOCAÇÃO. A prova pode estar num produto, num módulo ou numa
// vitrine — o contexto é resolvido a partir do container da colocação.
export default async function ProvaPage({
  params,
}: {
  params: Promise<{ pid: string }>;
}) {
  const { pid } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const placement = await prisma.examPlacement.findUnique({
    where: { id: pid },
    include: {
      exam: { include: { questions: { include: { options: true } } } },
      releaseCondition: true,
      trilha: { select: { id: true, title: true, vitrineId: true, releaseCondition: true } },
      modulo: {
        select: {
          id: true,
          title: true,
          releaseCondition: true,
          trilha: { select: { id: true, title: true, vitrineId: true, releaseCondition: true } },
        },
      },
      vitrine: { select: { id: true, name: true } },
    },
  });
  if (!placement || placement.exam.tenantId !== user.tenantId) notFound();

  const exam = placement.exam;
  const trilhaCtx = placement.trilha ?? placement.modulo?.trilha ?? null;
  const vitrineId =
    placement.trilha?.vitrineId ??
    placement.modulo?.trilha.vitrineId ??
    placement.vitrine?.id ??
    null;

  const backHref = trilhaCtx
    ? `/trilhas/${trilhaCtx.id}`
    : placement.vitrine
    ? `/vitrines/${placement.vitrine.id}`
    : "/dashboard";
  const contextName =
    placement.modulo?.title ?? trilhaCtx?.title ?? placement.vitrine?.name ?? "";

  // Respeita o perfil de acesso do aluno.
  const allowed = await allowedVitrineIds(user);
  if (!canAccessVitrine(allowed, vitrineId)) notFound();

  if (user.role === "STUDENT") {
    const prog = await loadProgress(user.id);
    const ctx = {
      moduloId: placement.moduloId,
      trilhaId: placement.trilhaId ?? placement.modulo?.trilha.id ?? null,
    };
    // O produto/módulo que contém a prova precisa estar liberado.
    const containerCond =
      placement.modulo?.releaseCondition ?? placement.trilha?.releaseCondition ?? null;
    if (containerCond) {
      const r = await isUnlocked(containerCond, { trilhaId: ctx.trilhaId }, prog);
      if (!r.unlocked) redirect(backHref);
    }
    // Condição da própria colocação da prova.
    const own = await isUnlocked(placement.releaseCondition, ctx, prog);
    if (!own.unlocked) redirect(backHref);
  }

  // Prova final do produto: se já tem certificado, não refaz a prova.
  const isProdutoExam = !!placement.trilha && !placement.moduloId && !placement.vitrineId;
  if (isProdutoExam && placement.trilha) {
    const cert = await prisma.certificate.findFirst({
      where: { userId: user.id, trilhaId: placement.trilha.id },
    });
    if (cert) redirect(`/certificados/${cert.code}`);
  }

  // SORTEIO: pega `questionsToShow` questões aleatórias do banco cadastrado.
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
          {contextName ? `${contextName} · ` : ""}
          {sampled.length} questões · {exam.passingScore}% para aprovação
        </p>
        <ExamRunner placementId={placement.id} questions={sampled} backHref={backHref} />
      </div>
    </AppShell>
  );
}

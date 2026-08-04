import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds, canAccessVitrine } from "@/lib/access";
import { completedTrilhaIds, lockReason } from "@/lib/progress";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import CourseCard from "@/components/CourseCard";
import { coverFor } from "@/lib/cover";

export default async function VitrinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const vitrine = await prisma.vitrine.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      prereqTrilha: { select: { id: true, title: true } },
      trilhas: {
        where: { published: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          _count: { select: { aulas: true } },
          enrollments: { where: { userId: user.id } },
          certificates: { where: { userId: user.id } },
        },
      },
      // Provas colocadas na vitrine (avaliação geral da área).
      examPlacements: {
        include: {
          exam: { select: { title: true, passingScore: true, questionsToShow: true, _count: { select: { questions: true } } } },
        },
      },
    },
  });
  if (!vitrine) notFound();

  const allowed = await allowedVitrineIds(user);
  if (!canAccessVitrine(allowed, vitrine.id)) notFound();

  // Pré-requisito de liberação (B2): admin não é bloqueado.
  const completedTrilhas =
    user.role === "STUDENT" ? await completedTrilhaIds(user.id) : new Set<string>();
  const locked =
    user.role === "STUDENT"
      ? lockReason(vitrine.prereqTrilhaId, vitrine.prereqTrilha?.title, completedTrilhas)
      : null;

  if (locked) {
    return (
      <AppShell user={user} tenant={user.tenant}>
        <div className="card mx-auto mt-6 max-w-lg text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-3 text-xl font-bold text-ink">{vitrine.name}</h1>
          <p className="mt-2 text-slate-500">{locked}</p>
          {vitrine.prereqTrilha && (
            <Link href={`/trilhas/${vitrine.prereqTrilha.id}`} className="btn-brand mt-5 inline-flex">
              Ir para o pré-requisito
            </Link>
          )}
        </div>
      </AppShell>
    );
  }

  const { c1, c2 } = coverFor(vitrine.name);

  return (
    <AppShell user={user} tenant={user.tenant} fluid>
      <section
        className="relative text-white"
        style={
          vitrine.bannerUrl || vitrine.coverUrl
            ? { background: `linear-gradient(0deg, rgba(11,17,32,.75), rgba(11,17,32,.35)), url(${vitrine.bannerUrl || vitrine.coverUrl}) center/cover` }
            : ({ ["--c1" as string]: c1, ["--c2" as string]: c2, backgroundImage: `linear-gradient(135deg, var(--c1), var(--c2))` } as React.CSSProperties)
        }
      >
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Link href="/dashboard" className="text-sm text-white/70 hover:text-white">
            ← Voltar
          </Link>
          <p className="eyebrow mt-3 text-white/60">Vitrine</p>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">{vitrine.name}</h1>
          {vitrine.description && (
            <p className="mt-2 max-w-2xl text-white/80">{vitrine.description}</p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {vitrine.trilhas.length === 0 ? (
          <div className="card text-center text-slate-500">
            Nenhum treinamento publicado nesta vitrine ainda.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vitrine.trilhas.map((t) => (
              <CourseCard
                key={t.id}
                id={t.id}
                title={t.title}
                description={t.description}
                coverUrl={t.coverUrl}
                aulas={t._count.aulas}
                done={t.enrollments[0]?.status === "COMPLETED"}
                hasCert={t.certificates.length > 0}
                progress={t.enrollments.length > 0 ? 45 : 0}
              />
            ))}
          </div>
        )}

        {/* Provas da vitrine (avaliação geral da área) */}
        {vitrine.examPlacements.filter((p) => p.exam._count.questions > 0).length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-bold text-ink">Avaliações da vitrine</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vitrine.examPlacements
                .filter((p) => p.exam._count.questions > 0)
                .map((p) => (
                  <div key={p.id} className="card flex flex-col">
                    <h3 className="font-bold text-ink">{p.exam.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {p.exam.questionsToShow} questões · {p.exam.passingScore}% para aprovação
                    </p>
                    <Link href={`/prova/${p.id}`} className="btn-brand mt-4 w-full">
                      Fazer avaliação
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

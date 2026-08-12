import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds, canAccessVitrine, contentTenantIds, grantedSharedVitrineIds, vitrineVisible } from "@/lib/access";
import { loadProgress, isUnlocked } from "@/lib/release";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import PosterCard from "@/components/PosterCard";
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
    where: { id, tenantId: { in: contentTenantIds(user.tenant) } },
    include: {
      releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
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

  // Conteúdo da mãe só é acessível se liberado para esta filha.
  const granted = await grantedSharedVitrineIds(user.tenant);
  if (!vitrineVisible(user.tenant, vitrine.tenantId, vitrine.id, granted)) notFound();

  const allowed = await allowedVitrineIds(user);
  if (!canAccessVitrine(allowed, vitrine.id)) notFound();

  // Condição de liberação (Fase 2): admin não é bloqueado.
  const locked =
    user.role === "STUDENT"
      ? await isUnlocked(vitrine.releaseCondition, {}, await loadProgress(user.id))
      : { unlocked: true, reason: null };

  const light = user.tenant.theme === "light";

  if (!locked.unlocked) {
    const targetTrilhaId =
      vitrine.releaseCondition?.clauses.find((c) => c.targetTrilhaId)?.targetTrilhaId ?? null;
    return (
      <AppShell user={user} tenant={user.tenant} dark light={light}>
        <div className="s-card mx-auto mt-10 max-w-lg rounded-2xl p-8 text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="s-fg mt-3 text-xl font-bold">{vitrine.name}</h1>
          <p className="s-muted mt-2">{locked.reason}</p>
          {targetTrilhaId && (
            <Link href={`/trilhas/${targetTrilhaId}`} className="btn-brand mt-5 inline-flex">
              Ir para o pré-requisito
            </Link>
          )}
        </div>
      </AppShell>
    );
  }

  const { c1, c2 } = coverFor(vitrine.name);

  return (
    <AppShell user={user} tenant={user.tenant} fluid dark light={light}>
      <section
        className="relative flex min-h-[260px] items-end text-white"
        style={
          vitrine.bannerUrl || vitrine.coverUrl
            ? { background: `url(${vitrine.bannerUrl || vitrine.coverUrl}) center/cover` }
            : ({ ["--c1" as string]: c1, ["--c2" as string]: c2, backgroundImage: `linear-gradient(135deg, var(--c1), var(--c2))` } as React.CSSProperties)
        }
      >
        <div className="s-fade-bottom absolute inset-0" />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
          <Link href="/dashboard" className="text-sm text-white/70 hover:text-white">
            ← Voltar
          </Link>
          <p className="eyebrow mt-3 text-white/50">Vitrine</p>
          <h1 className="mt-1 text-3xl font-black drop-shadow sm:text-4xl">{vitrine.name}</h1>
          {vitrine.description && (
            <p className="mt-2 max-w-2xl text-white/80">{vitrine.description}</p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {vitrine.trilhas.length === 0 ? (
          <div className="s-card s-muted rounded-2xl p-8 text-center">
            Nenhum treinamento publicado nesta vitrine ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {vitrine.trilhas.map((t) => (
              <PosterCard
                key={t.id}
                title={t.title}
                seed={t.title}
                coverUrl={t.coverUrl}
                href={`/trilhas/${t.id}`}
                subtitle={`${t._count.aulas} aula(s)`}
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
            <h2 className="s-fg mb-4 text-lg font-bold">Avaliações da vitrine</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vitrine.examPlacements
                .filter((p) => p.exam._count.questions > 0)
                .map((p) => (
                  <div key={p.id} className="s-card flex flex-col rounded-2xl p-5">
                    <h3 className="s-fg font-bold">{p.exam.title}</h3>
                    <p className="s-muted mt-1 text-sm">
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

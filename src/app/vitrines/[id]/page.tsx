import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
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
      trilhas: {
        where: { published: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          _count: { select: { aulas: true } },
          enrollments: { where: { userId: user.id } },
          certificates: { where: { userId: user.id } },
        },
      },
    },
  });
  if (!vitrine) notFound();

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
      </div>
    </AppShell>
  );
}

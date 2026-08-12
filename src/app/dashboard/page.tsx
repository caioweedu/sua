import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds, visibleVitrineWhere } from "@/lib/access";
import { loadProgress, isUnlocked } from "@/lib/release";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import Row from "@/components/Row";
import PosterCard from "@/components/PosterCard";
import HeroCarousel from "@/components/HeroCarousel";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await allowedVitrineIds(user);
  const isStudent = user.role === "STUDENT";
  // Vitrines visíveis = próprias + as da mãe liberadas para esta filha.
  const visWhere = await visibleVitrineWhere(user.tenant);

  // Busca vitrines, progresso do aluno, produtos soltos e slides do hero em
  // paralelo — evita round-trips em série ao banco.
  const [vitrines, prog, soltos, heroSlides] = await Promise.all([
    prisma.vitrine.findMany({
      where: {
        ...visWhere,
        published: true,
        ...(allowed ? { id: { in: allowed } } : {}),
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
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
      },
    }),
    isStudent ? loadProgress(user.id) : Promise.resolve(null),
    // Produtos sem vitrine (só para acesso total).
    allowed === null
      ? prisma.trilha.findMany({
          where: { tenantId: user.tenantId, published: true, vitrineId: null },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: {
            _count: { select: { aulas: true } },
            enrollments: { where: { userId: user.id } },
            certificates: { where: { userId: user.id } },
          },
        })
      : Promise.resolve([]),
    prisma.heroSlide.findMany({
      where: { tenantId: user.tenantId, active: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  // Condição de liberação (só afeta alunos): avalia todos os cadeados em paralelo.
  const vitrineLock = new Map<string, string | null>();
  const lockResults = await Promise.all(
    vitrines.map((v) =>
      prog ? isUnlocked(v.releaseCondition, {}, prog) : Promise.resolve({ unlocked: true, reason: null })
    )
  );
  vitrines.forEach((v, i) => {
    const r = lockResults[i];
    vitrineLock.set(v.id, r.unlocked ? null : r.reason);
  });

  const banner = user.tenant.bannerUrl;
  const nome = user.name.split(" ")[0];
  const vitrinesComConteudo = vitrines.filter((v) => v.trilhas.length > 0);
  const vazio = vitrinesComConteudo.length === 0 && soltos.length === 0;
  const light = user.tenant.theme === "light";

  return (
    <AppShell user={user} tenant={user.tenant} fluid dark light={light}>
      {/* Hero de topo: carrossel rotativo (se houver slides) ou hero padrão */}
      {heroSlides.length > 0 ? (
        <HeroCarousel slides={heroSlides} />
      ) : (
        <section
          className="relative flex min-h-[280px] items-end sm:min-h-[380px]"
          style={banner ? { background: `url(${banner}) center/cover` } : undefined}
        >
          {!banner && <div className="brand-immersive absolute inset-0" />}
          <div className="s-fade-bottom absolute inset-0" />
          <div className="relative mx-auto w-full max-w-6xl px-4 pb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              {user.tenant.name}
            </p>
            <h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight text-white drop-shadow sm:text-5xl">
              Olá, {nome}. Bora aprender? 👋
            </h1>
            <p className="mt-2 max-w-xl text-white/75">
              Continue de onde parou ou explore uma nova trilha abaixo.
            </p>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl pb-16">
        {vazio ? (
          <div className="s-card s-muted mx-4 mt-8 rounded-2xl p-8 text-center">
            {allowed && allowed.length === 0
              ? "Nenhum conteúdo liberado para o seu perfil ainda. Fale com o administrador."
              : "Nenhum conteúdo publicado ainda."}
          </div>
        ) : (
          <>
            {vitrinesComConteudo.map((v) => {
              const reason = vitrineLock.get(v.id) ?? null;
              const locked = !!reason;
              return (
                <Row
                  key={v.id}
                  title={v.name}
                  href={locked ? undefined : `/vitrines/${v.id}`}
                  hrefLabel="Explorar"
                  locked={locked}
                  note={reason}
                >
                  {v.trilhas.map((t) => (
                    <PosterCard
                      key={t.id}
                      title={t.title}
                      seed={t.title}
                      coverUrl={t.coverUrl}
                      href={locked ? undefined : `/trilhas/${t.id}`}
                      subtitle={`${t._count.aulas} aula(s)`}
                      done={t.enrollments[0]?.status === "COMPLETED"}
                      hasCert={t.certificates.length > 0}
                      progress={t.enrollments.length > 0 ? 45 : 0}
                      locked={locked}
                    />
                  ))}
                </Row>
              );
            })}

            {soltos.length > 0 && (
              <Row title="Outros treinamentos">
                {soltos.map((t) => (
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
              </Row>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

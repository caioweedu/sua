import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds } from "@/lib/access";
import { loadProgress, isUnlocked } from "@/lib/release";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import Row from "@/components/Row";
import PosterCard from "@/components/PosterCard";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await allowedVitrineIds(user);

  const vitrines = await prisma.vitrine.findMany({
    where: {
      tenantId: user.tenantId,
      published: true,
      ...(allowed ? { id: { in: allowed } } : {}),
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      releaseCondition: { include: { clauses: true } },
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

  // Condição de liberação (só afeta alunos).
  const prog = user.role === "STUDENT" ? await loadProgress(user.id) : null;
  const vitrineLock = new Map<string, string | null>();
  for (const v of vitrines) {
    const r = prog ? await isUnlocked(v.releaseCondition, {}, prog) : { unlocked: true, reason: null };
    vitrineLock.set(v.id, r.unlocked ? null : r.reason);
  }

  // Produtos sem vitrine (só para acesso total).
  const soltos =
    allowed === null
      ? await prisma.trilha.findMany({
          where: { tenantId: user.tenantId, published: true, vitrineId: null },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: {
            _count: { select: { aulas: true } },
            enrollments: { where: { userId: user.id } },
            certificates: { where: { userId: user.id } },
          },
        })
      : [];

  const banner = user.tenant.bannerUrl;
  const nome = user.name.split(" ")[0];
  const vitrinesComConteudo = vitrines.filter((v) => v.trilhas.length > 0);
  const vazio = vitrinesComConteudo.length === 0 && soltos.length === 0;
  const light = user.tenant.theme === "light";

  return (
    <AppShell user={user} tenant={user.tenant} fluid dark light={light}>
      {/* Hero de topo (banner do tenant ou gradiente da marca) */}
      <section
        className="relative flex min-h-[280px] items-end sm:min-h-[380px]"
        style={
          banner
            ? { background: `url(${banner}) center/cover` }
            : undefined
        }
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

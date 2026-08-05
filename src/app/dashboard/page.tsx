import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds } from "@/lib/access";
import { loadProgress, isUnlocked } from "@/lib/release";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import VitrineCard from "@/components/VitrineCard";
import CourseCard from "@/components/CourseCard";

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
      _count: { select: { trilhas: { where: { published: true } } } },
      releaseCondition: { include: { clauses: true } },
    },
  });

  // Condição de liberação (Fase 2): só afeta alunos.
  const prog = user.role === "STUDENT" ? await loadProgress(user.id) : null;
  const vitrineLock = new Map<string, string | null>();
  for (const v of vitrines) {
    const r = prog ? await isUnlocked(v.releaseCondition, {}, prog) : { unlocked: true, reason: null };
    vitrineLock.set(v.id, r.unlocked ? null : r.reason);
  }

  // Produtos sem vitrine só aparecem para quem tem acesso total (sem perfil).
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

  return (
    <AppShell user={user} tenant={user.tenant} fluid>
      {/* Banner / hero */}
      <section
        className="brand-immersive text-white"
        style={
          banner
            ? { background: `linear-gradient(0deg, rgba(11,17,32,.75), rgba(11,17,32,.35)), url(${banner}) center/cover` }
            : undefined
        }
      >
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <p className="eyebrow text-white/50">{user.tenant.name}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Olá, {user.name.split(" ")[0]}. Bora aprender? 👋
          </h1>
          <p className="mt-2 max-w-xl text-white/70">
            Escolha uma vitrine para explorar os treinamentos.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {vitrines.length === 0 && soltos.length === 0 ? (
          <div className="card text-center text-slate-500">
            {allowed && allowed.length === 0
              ? "Nenhum conteúdo liberado para o seu perfil ainda. Fale com o administrador."
              : "Nenhum conteúdo publicado ainda."}
          </div>
        ) : (
          <div className="space-y-10">
            {vitrines.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-bold text-ink">Vitrines</h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {vitrines.map((v) => (
                    <VitrineCard
                      key={v.id}
                      id={v.id}
                      name={v.name}
                      description={v.description}
                      coverUrl={v.coverUrl}
                      produtos={v._count.trilhas}
                      lockReason={vitrineLock.get(v.id) ?? null}
                    />
                  ))}
                </div>
              </section>
            )}

            {soltos.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-bold text-ink">Outros treinamentos</h2>
                <div className="row-scroll -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
                  {soltos.map((t) => (
                    <div key={t.id} className="w-[280px] shrink-0">
                      <CourseCard
                        id={t.id}
                        title={t.title}
                        description={t.description}
                        coverUrl={t.coverUrl}
                        aulas={t._count.aulas}
                        done={t.enrollments[0]?.status === "COMPLETED"}
                        hasCert={t.certificates.length > 0}
                        progress={t.enrollments.length > 0 ? 45 : 0}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

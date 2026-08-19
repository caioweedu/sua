import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds, visibleVitrineWhere, contentTenantIds } from "@/lib/access";
import { loadUserAgenda } from "@/lib/agenda";
import { loadProgress, isUnlocked } from "@/lib/release";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import Row from "@/components/Row";
import PosterCard from "@/components/PosterCard";
import HeroCarousel from "@/components/HeroCarousel";
import XpCard from "@/components/XpCard";
import BadgesStrip from "@/components/BadgesStrip";
import StreakCard from "@/components/StreakCard";
import { getGamificationStatus, getStreak, gamificationActive } from "@/lib/gamification";
import { getBadgeShowcase } from "@/lib/badges";
import { getLevelIconMap } from "@/lib/levelIcons";

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

  // Gamificação: XP/nível + ofensiva + conquistas do aluno (só para STUDENT e
  // quando a filha tem gamificação habilitada).
  const gamiOn = isStudent && gamificationActive(user.tenant);
  const rankingOn = gamiOn && user.tenant.rankingEnabled;
  const [gami, streak, badges, levelIcons] = gamiOn
    ? await Promise.all([
        getGamificationStatus(user.id),
        getStreak(user.id),
        getBadgeShowcase(user.id),
        getLevelIconMap(),
      ])
    : [null, null, null, null];

  const banner = user.tenant.bannerUrl;
  // Agenda de treinamentos planejados para esta pessoa (F3).
  const agenda = await loadUserAgenda(
    user.id,
    user.tenantId,
    user.teamId,
    contentTenantIds(user.tenant)
  );

  // Atalho para o painel de acompanhamento (RH, gestor ou supervisor).
  const teamPanel =
    user.role === "HR" ||
    (await prisma.teamLead.count({
      where: { userId: user.id, team: { tenantId: user.tenantId } },
    })) > 0;

  const agendaStatus = (a: (typeof agenda)[number]) =>
    a.completed
      ? "Concluído ✓"
      : `${
          a.dueDate
            ? (a.overdue ? "Atrasado" : "Prazo") + ": " + new Date(a.dueDate).toLocaleDateString("pt-BR")
            : "Sem prazo"
        } · ${a.progressPct}%`;

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
        {teamPanel && (
          <div className="px-4 pt-6">
            <Link
              href="/minha-equipe"
              className="s-card flex items-center justify-between gap-3 rounded-2xl px-5 py-4 transition hover:brightness-110"
            >
              <span className="s-fg font-semibold">
                🧑‍💼 {user.role === "HR" ? "Painel de RH" : "Acompanhar minha equipe"}
              </span>
              <span className="s-muted text-sm">ver progresso →</span>
            </Link>
          </div>
        )}
        {agenda.length > 0 && (
          <div className="px-4 pt-6">
            <div className="s-card rounded-2xl p-5">
              <h2 className="s-fg mb-1 font-bold">📌 Meus treinamentos planejados</h2>
              <p className="s-muted mb-3 text-sm">
                Definidos pela sua empresa. Fique de olho nos prazos.
              </p>
              <ul className="space-y-2">
                {agenda.map((a) => (
                  <li key={a.trilhaId}>
                    <Link
                      href={`/trilhas/${a.trilhaId}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 transition hover:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="s-fg font-medium">{a.title}</span>
                        {a.required && (
                          <span className="s-muted ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px]">obrigatório</span>
                        )}
                        <span
                          className={`block text-xs ${a.overdue && !a.completed ? "font-semibold text-red-400" : "s-muted"}`}
                        >
                          {agendaStatus(a)}
                        </span>
                      </span>
                      {!a.completed && <span className="s-muted text-xs font-semibold">continuar →</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {gami && <XpCard status={gami} iconUrl={levelIcons?.get(gami.level)} />}
        {streak != null && <StreakCard streak={streak} />}
        {badges && <BadgesStrip badges={badges} />}
        {rankingOn && (
          <div className="mx-4 mt-4">
            <Link
              href="/ranking"
              className="s-card flex items-center justify-between rounded-2xl p-4 font-semibold hover:opacity-90 sm:p-5"
            >
              <span>🏆 Ver ranking da turma</span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        )}
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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedVitrineIds, canAccessVitrine, contentTenantIds } from "@/lib/access";
import { loadProgress, isUnlocked, type UnlockResult } from "@/lib/release";
import { prisma } from "@/lib/db";
import { toEmbedUrl, videoProvider } from "@/lib/video";
import { enroll, claimCertificate } from "@/lib/actions/learning";
import AppShell from "@/components/AppShell";
import ProfessorChat from "@/components/ProfessorChat";
import SubmitButton from "@/components/SubmitButton";
import FlashcardStudy from "./flashcard-study";
import LessonPlayer from "./lesson-player";

export default async function TrilhaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { id } = await params;
  const { a } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trilha = await prisma.trilha.findFirst({
    where: { id, tenantId: { in: contentTenantIds(user.tenant) } },
    include: {
      vitrine: { select: { id: true, name: true } },
      releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
      modulos: {
        orderBy: { order: "asc" },
        include: {
          releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
          aulas: { orderBy: { order: "asc" } },
          examPlacements: {
            include: {
              releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
              exam: { select: { title: true, _count: { select: { questions: true } } } },
            },
          },
        },
      },
      // Aulas sem módulo (conteúdo antigo/avulso).
      aulas: { where: { moduloId: null }, orderBy: { order: "asc" } },
      // Provas do produto (colocação de trilha).
      examPlacements: {
        include: {
          releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
          exam: { select: { title: true, passingScore: true, questionsToShow: true, _count: { select: { questions: true } } } },
        },
      },
      // Certificados colocados no produto (Fase 3).
      certificatePlacements: {
        include: { template: { select: { name: true } }, releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } } },
      },
      // Flashcards de estudo (Fase 5 — fatia 3).
      flashcards: { orderBy: { order: "asc" }, select: { id: true, front: true, back: true } },
      enrollments: { where: { userId: user.id } },
      certificates: { where: { userId: user.id } },
    },
  });
  if (!trilha) notFound();

  const allowed = await allowedVitrineIds(user);
  if (!canAccessVitrine(allowed, trilha.vitrineId)) notFound();

  // Tema da área do aluno (escuro imersivo por padrão), igual à home.
  const light = user.tenant.theme === "light";

  // Progresso do aluno (para gating e barra de progresso). Admin não é bloqueado.
  const isStudent = user.role === "STUDENT";
  const prog = isStudent ? await loadProgress(user.id) : null;

  // Condição de liberação do produto (Fase 2).
  const produtoLock =
    prog ? await isUnlocked(trilha.releaseCondition, {}, prog) : ({ unlocked: true, reason: null } as UnlockResult);

  if (!produtoLock.unlocked) {
    const targetTrilhaId =
      trilha.releaseCondition?.clauses.find((c) => c.targetTrilhaId)?.targetTrilhaId ?? null;
    return (
      <AppShell user={user} tenant={user.tenant} dark light={light}>
        <nav className="flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/dashboard" className="hover:text-ink">Início</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700">{trilha.title}</span>
        </nav>
        <div className="card mt-6 mx-auto max-w-lg text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-3 text-xl font-bold text-ink">Conteúdo bloqueado</h1>
          <p className="mt-2 text-slate-500">{produtoLock.reason}</p>
          {targetTrilhaId && (
            <Link href={`/trilhas/${targetTrilhaId}`} className="btn-brand mt-5 inline-flex">
              Ir para o pré-requisito
            </Link>
          )}
        </div>
      </AppShell>
    );
  }

  // Conjunto de aulas concluídas (todas as do aluno; usamos .has por id).
  const doneAulas = prog ? prog.doneAulas : new Set<string>();

  // Liberação por módulo (Fase 2): um módulo bloqueado não tem aulas jogáveis.
  const moduloLock = new Map<string, UnlockResult>();
  for (const m of trilha.modulos) {
    moduloLock.set(
      m.id,
      prog ? await isUnlocked(m.releaseCondition, { trilhaId: trilha.id }, prog) : { unlocked: true, reason: null }
    );
  }

  const enrolled = trilha.enrollments.length > 0;
  const cert = trilha.certificates[0];
  // Provas finais do produto (só as que têm banco de questões).
  const produtoProvas = trilha.examPlacements.filter((p) => p.exam._count.questions > 0);
  const hasExam = produtoProvas.length > 0;

  // Avalia a liberação de cada prova (produto e módulos).
  const provaLock = new Map<string, UnlockResult>();
  for (const p of trilha.examPlacements) {
    provaLock.set(p.id, prog ? await isUnlocked(p.releaseCondition, { trilhaId: trilha.id }, prog) : { unlocked: true, reason: null });
  }
  for (const m of trilha.modulos) {
    for (const p of m.examPlacements) {
      provaLock.set(p.id, prog ? await isUnlocked(p.releaseCondition, { trilhaId: trilha.id, moduloId: m.id }, prog) : { unlocked: true, reason: null });
    }
  }

  // Certificado do produto (Fase 3): mostra emitir/ver quando aplicável.
  const certPlacement = trilha.certificatePlacements[0] ?? null;
  const certUnlock =
    certPlacement && prog
      ? await isUnlocked(certPlacement.releaseCondition, { trilhaId: trilha.id }, prog)
      : null;

  // Monta os grupos da trilha lateral (módulos + eventuais aulas avulsas).
  // Cada módulo carrega id, estado de liberação e suas provas (checkpoints).
  const grupos = [
    ...trilha.modulos.map((m) => ({
      moduloId: m.id,
      title: m.title,
      coverUrl: m.coverUrl as string | null,
      aulas: m.aulas,
      provas: m.examPlacements.filter((p) => p.exam._count.questions > 0),
      lock: moduloLock.get(m.id) ?? { unlocked: true, reason: null },
    })),
    ...(trilha.aulas.length > 0
      ? [{
          moduloId: null as string | null,
          title: "Aulas",
          coverUrl: null as string | null,
          aulas: trilha.aulas,
          provas: [] as typeof trilha.modulos[number]["examPlacements"],
          lock: { unlocked: true, reason: null } as UnlockResult,
        }]
      : []),
  ];
  // Só contam/são jogáveis as aulas de módulos liberados.
  const flat = grupos.filter((g) => g.lock.unlocked).flatMap((g) => g.aulas);
  const totalAulas = flat.length;
  const doneCount = flat.filter((x) => doneAulas.has(x.id)).length;
  const progressPct = totalAulas > 0 ? Math.round((doneCount / totalAulas) * 100) : 0;

  // Liberação SEQUENCIAL das aulas (estilo Udemy). Só vale para aluno
  // matriculado: a aula abre quando a anterior é concluída, e uma aula
  // concluída fica sempre aberta. Admin (preview) e aluno antes de começar
  // não entram nessa regra — o admin vê tudo; o aluno vê o botão "Começar".
  const seqGated = isStudent && enrolled;
  function aulaUnlockedAt(i: number): boolean {
    if (!seqGated) return true;
    const aula = flat[i];
    if (!aula) return false;
    if (doneAulas.has(aula.id)) return true;
    if (i === 0) return true;
    return doneAulas.has(flat[i - 1].id);
  }
  const unlockedAulaIds = new Set(
    flat.filter((_, i) => aulaUnlockedAt(i)).map((x) => x.id)
  );
  // Uma aula é "acessível" para o aluno se estiver matriculado e liberada.
  function aulaOpen(id: string): boolean {
    if (!isStudent) return true; // admin: preview livre
    if (!enrolled) return false; // precisa começar a trilha
    return unlockedAulaIds.has(id);
  }

  // Aula atual: respeita a liberação. Se a URL apontar para uma aula bloqueada
  // (ou nenhuma), retoma na primeira liberada ainda não concluída.
  let current =
    a && unlockedAulaIds.has(a) ? flat.find((x) => x.id === a) ?? null : null;
  if (!current) {
    current =
      flat.find((x, i) => aulaUnlockedAt(i) && !doneAulas.has(x.id)) ??
      flat.find((_, i) => aulaUnlockedAt(i)) ??
      flat[0] ??
      null;
  }
  const currentIndex = current ? flat.findIndex((x) => x.id === current.id) : -1;
  const currentDone = current ? doneAulas.has(current.id) : false;
  const nextAula =
    currentIndex >= 0 && currentIndex + 1 < flat.length ? flat[currentIndex + 1] : null;
  const embed = current?.videoUrl ? toEmbedUrl(current.videoUrl) : null;
  // Player só toca quando o aluno já começou (ou é admin em preview).
  const canWatch = !isStudent || enrolled;

  return (
    <AppShell user={user} tenant={user.tenant} dark light={light}>
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="hover:text-ink">Início</Link>
        {trilha.vitrine && (
          <>
            <span className="text-slate-300">/</span>
            <Link href={`/vitrines/${trilha.vitrine.id}`} className="hover:text-ink">
              {trilha.vitrine.name}
            </Link>
          </>
        )}
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">{trilha.title}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-ink">{trilha.title}</h1>
          {trilha.description && (
            <p className="mt-1 max-w-2xl text-slate-500">{trilha.description}</p>
          )}
          {enrolled && totalAulas > 0 && (
            <div className="mt-3 max-w-md">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Progresso</span>
                <span>{doneCount}/{totalAulas} aulas · {progressPct}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, background: "var(--brand-color)" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Player + material */}
        <div>
          {!canWatch ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-card">
              <div className="aspect-video">
                <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                  <div className="text-5xl">▶️</div>
                  <p className="max-w-sm text-slate-300">
                    Comece a trilha para liberar as aulas e acompanhar seu
                    progresso. As aulas abrem conforme você conclui a anterior.
                  </p>
                  <form action={enroll.bind(null, trilha.id)}>
                    <SubmitButton pendingText="Começando…">Começar trilha</SubmitButton>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <LessonPlayer
              key={current?.id ?? "none"}
              embed={embed}
              provider={videoProvider(embed)}
              title={current?.title ?? ""}
              description={current?.description ?? null}
              pdfUrl={current?.pdfUrl ?? null}
              indexLabel={currentIndex + 1}
              isStudent={user.role === "STUDENT"}
              currentDone={currentDone}
              currentId={current?.id ?? null}
              trilhaId={trilha.id}
              nextAulaId={nextAula?.id ?? null}
            />
          )}

          {/* Flashcards de estudo do produto (Fase 5 — fatia 3) */}
          {trilha.flashcards.length > 0 && (
            <FlashcardStudy cards={trilha.flashcards} />
          )}
        </div>

        {/* Trilha lateral agrupada por módulo */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-ink">Conteúdo do treinamento</h3>
              <p className="text-xs text-slate-400">
                {grupos.length} módulo(s) · {totalAulas} aula(s)
              </p>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              {grupos.map((g, gi) => (
                <div key={gi}>
                  {g.coverUrl && (
                    <div className="relative h-20 w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.coverUrl} alt="" className={`h-full w-full object-cover ${g.lock.unlocked ? "" : "grayscale"}`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <span className="absolute bottom-1.5 left-3 text-sm font-bold text-white drop-shadow">
                        {g.title}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <span>{g.coverUrl ? "Conteúdo" : g.title}</span>
                    {!g.lock.unlocked && <span title={g.lock.reason ?? ""}>🔒</span>}
                  </div>

                  {g.lock.unlocked ? (
                    <>
                      <ol>
                        {g.aulas.map((aula) => {
                          const active = current?.id === aula.id;
                          const done = doneAulas.has(aula.id);
                          const pos = flat.findIndex((x) => x.id === aula.id) + 1;
                          const open = aulaOpen(aula.id);
                          const badge = (
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                done
                                  ? "bg-green-100 text-green-700"
                                  : active
                                  ? "text-brand-fg"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                              style={active && !done ? { background: "var(--brand-color)" } : undefined}
                            >
                              {done ? "✓" : open ? pos : "🔒"}
                            </span>
                          );
                          return (
                            <li key={aula.id}>
                              {open ? (
                                <Link
                                  href={`/trilhas/${trilha.id}?a=${aula.id}`}
                                  className={`flex items-center gap-3 px-4 py-3 text-sm transition ${
                                    active ? "bg-brand/5" : "hover:bg-slate-50"
                                  }`}
                                >
                                  {badge}
                                  <span className={active ? "font-semibold text-ink" : "text-slate-600"}>
                                    {aula.title}
                                  </span>
                                  <span className="ml-auto text-slate-300">
                                    {aula.videoUrl ? "🎬" : aula.pdfUrl ? "📎" : ""}
                                  </span>
                                </Link>
                              ) : (
                                <div
                                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-400"
                                  title={
                                    enrolled
                                      ? "Conclua a aula anterior para liberar."
                                      : "Comece a trilha para liberar."
                                  }
                                >
                                  {badge}
                                  <span>{aula.title}</span>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                      {/* Provas do módulo (checkpoints) */}
                      {g.provas.map((p) => {
                        const lock = provaLock.get(p.id) ?? { unlocked: true, reason: null };
                        return (
                          <div key={p.id} className="border-t border-slate-100 px-4 py-3">
                            {!lock.unlocked ? (
                              <div className="flex items-center gap-3 text-sm text-slate-400">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs">
                                  🔒
                                </span>
                                <span>
                                  {p.exam.title}
                                  <span className="block text-xs">{lock.reason}</span>
                                </span>
                              </div>
                            ) : (
                              <Link
                                href={`/prova/${p.id}`}
                                className="flex items-center gap-3 text-sm text-brand hover:underline"
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs">
                                  📝
                                </span>
                                <span className="font-medium">{p.exam.title}</span>
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <p className="px-4 py-3 text-xs text-slate-400">{g.lock.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {cert ? (
            <div className="card mt-4">
              <h3 className="font-bold text-ink">Certificado disponível</h3>
              <Link href={`/certificados/${cert.code}`} className="btn-brand mt-4 w-full">
                🏆 Ver certificado
              </Link>
            </div>
          ) : (
            <>
              {hasExam && (
                <div className="card mt-4 space-y-4">
                  {produtoProvas.map((p) => {
                    const lock = provaLock.get(p.id) ?? { unlocked: true, reason: null };
                    return (
                      <div key={p.id}>
                        <h3 className="font-bold text-ink">{p.exam.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {p.exam.questionsToShow} questões sorteadas ·{" "}
                          {p.exam.passingScore}% para aprovação
                        </p>
                        {!lock.unlocked ? (
                          <>
                            <button
                              disabled
                              className="btn-brand mt-4 w-full cursor-not-allowed opacity-50"
                            >
                              🔒 Fazer avaliação
                            </button>
                            <p className="mt-2 text-center text-xs text-slate-500">
                              {lock.reason}
                            </p>
                          </>
                        ) : (
                          <Link href={`/prova/${p.id}`} className="btn-brand mt-4 w-full">
                            Fazer avaliação
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Emissão de certificado (Fase 3) */}
              {user.role === "STUDENT" && certPlacement && (
                <div className="card mt-4">
                  <h3 className="font-bold text-ink">🏆 {certPlacement.template.name}</h3>
                  {certUnlock?.unlocked ? (
                    <form action={claimCertificate.bind(null, certPlacement.id, trilha.id)}>
                      <SubmitButton className="btn-brand mt-3 w-full" pendingText="Emitindo…">
                        Emitir certificado
                      </SubmitButton>
                    </form>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      🔒 {certUnlock?.reason ?? "Disponível após concluir os requisitos."}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <ProfessorChat trilhaId={trilha.id} />
    </AppShell>
  );
}

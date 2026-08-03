import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toEmbedUrl } from "@/lib/video";
import { enroll } from "@/lib/actions/learning";
import AppShell from "@/components/AppShell";
import ProfessorChat from "@/components/ProfessorChat";

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
    where: { id, tenantId: user.tenantId },
    include: {
      aulas: { orderBy: { order: "asc" } },
      exam: { include: { _count: { select: { questions: true } } } },
      enrollments: { where: { userId: user.id } },
      certificates: { where: { userId: user.id } },
    },
  });
  if (!trilha) notFound();

  const enrolled = trilha.enrollments.length > 0;
  const cert = trilha.certificates[0];
  const hasExam = !!trilha.exam && trilha.exam._count.questions > 0;

  const current =
    trilha.aulas.find((x) => x.id === a) ?? trilha.aulas[0] ?? null;
  const currentIndex = current
    ? trilha.aulas.findIndex((x) => x.id === current.id)
    : -1;
  const embed = current?.videoUrl ? toEmbedUrl(current.videoUrl) : null;

  return (
    <AppShell user={user} tenant={user.tenant}>
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-ink">
        ← Voltar aos treinamentos
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          {trilha.category && <p className="eyebrow">{trilha.category}</p>}
          <h1 className="mt-1 text-2xl font-black text-ink">{trilha.title}</h1>
          {trilha.description && (
            <p className="mt-1 max-w-2xl text-slate-500">{trilha.description}</p>
          )}
        </div>
        {!enrolled && (
          <form action={enroll.bind(null, trilha.id)}>
            <button className="btn-brand" type="submit">
              Começar trilha
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Player + material */}
        <div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-card">
            <div className="aspect-video">
              {embed ? (
                <iframe
                  src={embed}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={current?.title}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">
                  Selecione uma aula para assistir
                </div>
              )}
            </div>
          </div>

          {current && (
            <div className="mt-4">
              <h2 className="text-lg font-bold text-ink">
                {currentIndex + 1}. {current.title}
              </h2>
              {current.description && (
                <p className="mt-1 text-slate-600">{current.description}</p>
              )}
              {current.pdfUrl && (
                <a
                  href={current.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand hover:text-brand"
                >
                  📎 Material de apoio (PDF)
                </a>
              )}
            </div>
          )}
        </div>

        {/* Trilha lateral */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-ink">Conteúdo da trilha</h3>
              <p className="text-xs text-slate-400">{trilha.aulas.length} aula(s)</p>
            </div>
            <ol className="max-h-[50vh] overflow-y-auto">
              {trilha.aulas.map((aula, i) => {
                const active = current?.id === aula.id;
                return (
                  <li key={aula.id}>
                    <Link
                      href={`/trilhas/${trilha.id}?a=${aula.id}`}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition ${
                        active ? "bg-brand/5" : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          active
                            ? "text-brand-fg"
                            : "bg-slate-100 text-slate-500"
                        }`}
                        style={active ? { background: "var(--brand-color)" } : undefined}
                      >
                        {i + 1}
                      </span>
                      <span className={active ? "font-semibold text-ink" : "text-slate-600"}>
                        {aula.title}
                      </span>
                      <span className="ml-auto text-slate-300">
                        {aula.videoUrl ? "🎬" : aula.pdfUrl ? "📎" : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>

          {hasExam && (
            <div className="card mt-4">
              <h3 className="font-bold text-ink">{trilha.exam!.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {trilha.exam!.questionsToShow} questões sorteadas ·{" "}
                {trilha.exam!.passingScore}% para aprovação
              </p>
              {cert ? (
                <Link href={`/certificados/${cert.code}`} className="btn-brand mt-4 w-full">
                  🏆 Ver certificado
                </Link>
              ) : (
                <Link href={`/trilhas/${trilha.id}/prova`} className="btn-brand mt-4 w-full">
                  Fazer avaliação
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>

      <ProfessorChat trilhaId={trilha.id} />
    </AppShell>
  );
}

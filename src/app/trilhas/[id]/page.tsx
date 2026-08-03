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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  return (
    <AppShell user={user} tenant={user.tenant}>
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Voltar
      </Link>

      <div className="mt-2 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{trilha.title}</h1>
          <p className="mt-1 text-slate-500">{trilha.description}</p>
        </div>
        {!enrolled && (
          <form action={enroll.bind(null, trilha.id)}>
            <button className="btn-brand" type="submit">
              Começar trilha
            </button>
          </form>
        )}
      </div>

      <div className="space-y-6">
        {trilha.aulas.map((aula, i) => {
          const embed = aula.videoUrl ? toEmbedUrl(aula.videoUrl) : null;
          return (
            <div key={aula.id} className="card">
              <h3 className="mb-2 font-semibold">
                {i + 1}. {aula.title}
              </h3>
              {aula.description && (
                <p className="mb-3 text-sm text-slate-500">{aula.description}</p>
              )}
              {embed && (
                <div className="aspect-video overflow-hidden rounded-lg bg-black">
                  <iframe
                    src={embed}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={aula.title}
                  />
                </div>
              )}
              {aula.pdfUrl && (
                <a
                  href={aula.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
                >
                  📎 Material de apoio (PDF)
                </a>
              )}
            </div>
          );
        })}
      </div>

      {trilha.exam && trilha.exam._count.questions > 0 && (
        <div className="card mt-6 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{trilha.exam.title}</h3>
            <p className="text-sm text-slate-500">
              {trilha.exam.questionsToShow} questões sorteadas ·{" "}
              {trilha.exam.passingScore}% para aprovação
            </p>
          </div>
          {cert ? (
            <Link href={`/certificados/${cert.code}`} className="btn-brand">
              🏆 Ver certificado
            </Link>
          ) : (
            <Link href={`/trilhas/${trilha.id}/prova`} className="btn-brand">
              Fazer avaliação
            </Link>
          )}
        </div>
      )}

      <ProfessorChat trilhaId={trilha.id} />
    </AppShell>
  );
}

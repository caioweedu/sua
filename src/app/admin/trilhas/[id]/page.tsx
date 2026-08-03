import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import {
  addAula,
  deleteAula,
  saveExam,
  addQuestion,
  deleteQuestion,
} from "@/lib/actions/admin";

export default async function ManageTrilhaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const trilha = await prisma.trilha.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      aulas: { orderBy: { order: "asc" } },
      exam: { include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } },
    },
  });
  if (!trilha) notFound();

  const exam = trilha.exam;
  const bankCount = exam?.questions.length ?? 0;

  return (
    <AppShell user={user} tenant={user.tenant}>
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Administração
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">{trilha.title}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aulas */}
        <section className="space-y-4">
          <div className="card">
            <h2 className="mb-4 font-semibold">Aulas ({trilha.aulas.length})</h2>
            <ul className="mb-4 space-y-2">
              {trilha.aulas.map((a, i) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm">
                    {i + 1}. {a.title}
                    {a.videoUrl && " 🎬"}
                    {a.pdfUrl && " 📎"}
                  </span>
                  <form action={deleteAula.bind(null, a.id, trilha.id)}>
                    <button className="text-xs text-red-500 hover:underline" type="submit">
                      remover
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addAula.bind(null, trilha.id)} className="space-y-2 border-t border-slate-100 pt-4">
              <input name="title" required className="input" placeholder="Título da aula" />
              <input name="videoUrl" className="input" placeholder="Link do vídeo (YouTube, Vimeo, Panda...)" />
              <input name="pdfUrl" className="input" placeholder="Link do PDF (opcional)" />
              <textarea name="description" className="input" rows={2} placeholder="Descrição (opcional)" />
              <button className="btn-brand" type="submit">
                Adicionar aula
              </button>
            </form>
          </div>
        </section>

        {/* Prova */}
        <section className="space-y-4">
          <div className="card">
            <h2 className="mb-2 font-semibold">Configuração da prova</h2>
            <p className="mb-4 text-xs text-slate-500">
              Banco atual: {bankCount} questão(ões). O sistema sorteia a
              quantidade definida abaixo a cada tentativa.
            </p>
            <form action={saveExam.bind(null, trilha.id)} className="space-y-2">
              <input name="title" defaultValue={exam?.title ?? "Avaliação final"} className="input" placeholder="Título da prova" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label">Questões por prova</label>
                  <input name="questionsToShow" type="number" min={1} defaultValue={exam?.questionsToShow ?? 6} className="input" />
                </div>
                <div className="flex-1">
                  <label className="label">Nota mínima (%)</label>
                  <input name="passingScore" type="number" min={0} max={100} defaultValue={exam?.passingScore ?? 70} className="input" />
                </div>
              </div>
              <button className="btn-brand" type="submit">
                Salvar prova
              </button>
            </form>
          </div>

          {exam && (
            <div className="card">
              <h2 className="mb-4 font-semibold">Banco de questões</h2>
              <ul className="mb-4 space-y-2">
                {exam.questions.map((q, i) => (
                  <li key={q.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm">
                        {i + 1}. {q.statement}
                      </span>
                      <form action={deleteQuestion.bind(null, q.id, trilha.id)}>
                        <button className="text-xs text-red-500 hover:underline" type="submit">
                          remover
                        </button>
                      </form>
                    </div>
                    <p className="mt-1 text-xs text-green-600">
                      ✓ {q.options.find((o) => o.isCorrect)?.text}
                    </p>
                  </li>
                ))}
              </ul>

              <form action={addQuestion.bind(null, exam.id, trilha.id)} className="space-y-2 border-t border-slate-100 pt-4">
                <textarea name="statement" required className="input" rows={2} placeholder="Enunciado da questão" />
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" value={i} defaultChecked={i === 0} title="Marcar como correta" />
                    <input name={`option${i}`} className="input" placeholder={`Alternativa ${i + 1}${i < 2 ? " (obrigatória)" : " (opcional)"}`} />
                  </div>
                ))}
                <p className="text-xs text-slate-400">
                  Marque o círculo da alternativa correta.
                </p>
                <button className="btn-brand" type="submit">
                  Adicionar questão
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeCondition } from "@/lib/release";
import AppShell from "@/components/AppShell";
import SubmitButton from "@/components/SubmitButton";
import {
  updateExam,
  deleteExam,
  addQuestion,
  deleteQuestion,
} from "@/lib/actions/admin";
import GerarQuestoesCard from "./gerar-questoes-card";

// Descreve, em texto, onde uma colocação está inserida.
function placementLabel(p: {
  vitrine?: { name: string } | null;
  trilha?: { title: string } | null;
  modulo?: { title: string; trilha: { title: string } } | null;
}): string {
  if (p.modulo) return `Módulo "${p.modulo.title}" · ${p.modulo.trilha.title}`;
  if (p.trilha) return `Produto "${p.trilha.title}"`;
  if (p.vitrine) return `Vitrine "${p.vitrine.name}"`;
  return "Colocação";
}

export default async function EditExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const exam = await prisma.exam.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      questions: { include: { options: true }, orderBy: { order: "asc" } },
      placements: {
        include: {
          vitrine: { select: { name: true } },
          trilha: { select: { title: true } },
          modulo: { select: { title: true, trilha: { select: { title: true } } } },
          releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
        },
      },
    },
  });
  if (!exam) notFound();

  return (
    <AppShell user={user} tenant={user.tenant}>
      <Link href="/admin/provas" className="text-sm text-slate-500 hover:text-slate-900">
        ← Biblioteca de provas
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">{exam.title}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          {/* Configuração */}
          <div className="card">
            <h2 className="mb-4 font-semibold">Configuração da prova</h2>
            <form action={updateExam.bind(null, exam.id)} className="space-y-2">
              <input name="title" defaultValue={exam.title} className="input" placeholder="Título da prova" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label">Questões por prova</label>
                  <input name="questionsToShow" type="number" min={1} defaultValue={exam.questionsToShow} className="input" />
                </div>
                <div className="flex-1">
                  <label className="label">Nota mínima (%)</label>
                  <input name="passingScore" type="number" min={0} max={100} defaultValue={exam.passingScore} className="input" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="shuffleOptions" defaultChecked={exam.shuffleOptions} className="h-4 w-4 rounded border-slate-300" />
                Embaralhar a ordem das alternativas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="showAnswers" defaultChecked={exam.showAnswers} className="h-4 w-4 rounded border-slate-300" />
                Mostrar as respostas corretas ao final
              </label>
              <SubmitButton pendingText="Salvando…">Salvar configuração</SubmitButton>
            </form>
          </div>

          {/* Onde está inserida */}
          <div className="card">
            <h2 className="mb-1 font-semibold">Onde esta prova está inserida</h2>
            <p className="mb-4 text-xs text-slate-500">
              Insira esta prova em produtos e módulos pela página do produto, e em
              vitrines pela Administração.
            </p>
            {exam.placements.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ainda não inserida em nenhum lugar.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {exam.placements.map((p) => (
                  <li key={p.id} className="py-2">
                    {placementLabel(p)}
                    {p.releaseCondition && (
                      <span className="text-amber-600"> · 🔒 {describeCondition(p.releaseCondition)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Zona de perigo */}
          <div className="card border-red-100">
            <h2 className="mb-2 font-semibold text-red-600">Excluir prova</h2>
            <p className="mb-3 text-xs text-slate-500">
              Remove a prova, seu banco de questões e todas as colocações.
            </p>
            <form action={deleteExam.bind(null, exam.id)}>
              <SubmitButton className="btn-outline border-red-200 text-sm text-red-600" pendingText="Excluindo…">
                Excluir prova
              </SubmitButton>
            </form>
          </div>
        </section>

        {/* Banco de questões */}
        <section className="card">
          <h2 className="mb-1 font-semibold">Banco de questões</h2>
          <p className="mb-4 text-xs text-slate-500">
            {exam.questions.length} questão(ões). O sistema sorteia{" "}
            {exam.questionsToShow} por tentativa.
          </p>
          <ul className="mb-4 space-y-2">
            {exam.questions.map((q, i) => (
              <li key={q.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm">{i + 1}. {q.statement}</span>
                  <form action={deleteQuestion.bind(null, q.id, exam.id)}>
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

          <form action={addQuestion.bind(null, exam.id)} className="space-y-2 border-t border-slate-100 pt-4">
            <textarea name="statement" required className="input" rows={2} placeholder="Enunciado da questão" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" value={i} defaultChecked={i === 0} title="Marcar como correta" />
                <input name={`option${i}`} className="input" placeholder={`Alternativa ${i + 1}${i < 2 ? " (obrigatória)" : " (opcional)"}`} />
              </div>
            ))}
            <p className="text-xs text-slate-400">Marque o círculo da alternativa correta.</p>
            <SubmitButton pendingText="Adicionando…">Adicionar questão</SubmitButton>
          </form>

          <GerarQuestoesCard examId={exam.id} />
        </section>
      </div>
    </AppShell>
  );
}

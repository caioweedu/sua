import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import SubmitButton from "@/components/SubmitButton";
import { createExam } from "@/lib/actions/admin";

// Biblioteca de provas: provas reutilizáveis do tenant. Uma prova criada aqui
// pode ser colocada em qualquer vitrine, produto ou módulo.
export default async function ProvasBibliotecaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const exams = await prisma.exam.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true, placements: true } },
    },
  });

  return (
    <AdminShell user={user} tenant={user.tenant}>
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Administração
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">Biblioteca de provas</h1>
      <p className="mb-6 text-sm text-slate-500">
        Crie provas reutilizáveis e depois insira cada uma em vitrines, produtos
        ou módulos.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold">Provas cadastradas</h2>
          {exams.length === 0 && (
            <p className="mb-4 text-sm text-slate-500">
              Nenhuma prova ainda. Crie a primeira ao lado.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {exams.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-3">
                <div>
                  <Link
                    href={`/admin/provas/${e.id}`}
                    className="font-medium hover:underline"
                  >
                    {e.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {e._count.questions} questão(ões) · sorteia{" "}
                    {e.questionsToShow} · {e.passingScore}% p/ aprovar ·{" "}
                    {e._count.placements === 0 ? (
                      <span className="text-amber-600">não inserida</span>
                    ) : (
                      <span className="text-green-600">
                        em {e._count.placements} local(is)
                      </span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/admin/provas/${e.id}`}
                  className="btn-outline text-sm"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Nova prova</h2>
          <form action={createExam} className="space-y-2">
            <input
              name="title"
              defaultValue="Avaliação final"
              className="input"
              placeholder="Título da prova"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">Questões por prova</label>
                <input
                  name="questionsToShow"
                  type="number"
                  min={1}
                  defaultValue={6}
                  className="input"
                />
              </div>
              <div className="flex-1">
                <label className="label">Nota mínima (%)</label>
                <input
                  name="passingScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={70}
                  className="input"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="shuffleOptions"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300"
              />
              Embaralhar a ordem das alternativas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="showAnswers"
                className="h-4 w-4 rounded border-slate-300"
              />
              Mostrar as respostas corretas ao final
            </label>
            <SubmitButton pendingText="Criando…">Criar prova</SubmitButton>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}

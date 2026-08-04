import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import {
  addAula,
  deleteAula,
  addModulo,
  deleteModulo,
  updateTrilhaMeta,
  attachExamToTrilha,
  attachExamToModulo,
  detachExamPlacement,
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

  const examSelect = {
    include: { exam: { select: { title: true, _count: { select: { questions: true } } } } },
  } as const;

  const trilha = await prisma.trilha.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      modulos: {
        orderBy: { order: "asc" },
        include: {
          aulas: { orderBy: { order: "asc" } },
          examPlacements: examSelect,
        },
      },
      // Provas colocadas no produto (não em módulos).
      examPlacements: examSelect,
    },
  });
  if (!trilha) notFound();

  const vitrines = await prisma.vitrine.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  // Outros produtos que podem servir de pré-requisito (exceto o atual).
  const outrosProdutos = await prisma.trilha.findMany({
    where: { tenantId: user.tenantId, id: { not: trilha.id } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  // Biblioteca de provas disponível para inserir.
  const bibliotecaProvas = await prisma.exam.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, _count: { select: { questions: true } } },
  });

  const backPath = `/admin/trilhas/${trilha.id}`;
  const hasBiblioteca = bibliotecaProvas.length > 0;

  return (
    <AppShell user={user} tenant={user.tenant}>
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Administração
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">{trilha.title}</h1>

      {/* Metadados do produto */}
      <div className="card mb-6">
        <h2 className="mb-4 font-semibold">Dados do treinamento</h2>
        <form action={updateTrilhaMeta.bind(null, trilha.id)} className="grid gap-3 sm:grid-cols-2">
          <input name="title" defaultValue={trilha.title} className="input" placeholder="Título" />
          <select name="vitrineId" defaultValue={trilha.vitrineId ?? ""} className="input">
            <option value="">Sem vitrine</option>
            {vitrines.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <input name="coverUrl" defaultValue={trilha.coverUrl ?? ""} className="input sm:col-span-2" placeholder="URL da capa (opcional)" />
          <textarea name="description" defaultValue={trilha.description ?? ""} className="input sm:col-span-2" rows={2} placeholder="Descrição" />
          <div className="sm:col-span-2">
            <label className="label">Liberar só após concluir (pré-requisito)</label>
            <select name="prereqTrilhaId" defaultValue={trilha.prereqTrilhaId ?? ""} className="input">
              <option value="">Sem pré-requisito</option>
              {outrosProdutos.map((o) => (
                <option key={o.id} value={o.id}>{o.title}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-brand" type="submit">Salvar dados</button>
          </div>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Módulos e aulas */}
        <section className="space-y-4">
          <div className="card">
            <h2 className="mb-1 font-semibold">Módulos e aulas</h2>
            <p className="mb-4 text-xs text-slate-500">
              Organize as aulas em módulos. Você pode inserir uma prova ao fim de
              cada módulo.
            </p>

            {trilha.modulos.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhum módulo ainda. Crie o primeiro abaixo.</p>
            )}

            <div className="space-y-4">
              {trilha.modulos.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="text-sm font-semibold text-ink">{m.title}</span>
                    <form action={deleteModulo.bind(null, m.id, trilha.id)}>
                      <button className="text-xs text-red-500 hover:underline" type="submit">
                        remover módulo
                      </button>
                    </form>
                  </div>
                  <ul className="divide-y divide-slate-50">
                    {m.aulas.map((a, i) => (
                      <li key={a.id} className="flex items-center justify-between px-3 py-2">
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
                    {m.aulas.length === 0 && (
                      <li className="px-3 py-2 text-xs text-slate-400">Sem aulas neste módulo.</li>
                    )}
                  </ul>

                  {/* Prova do módulo */}
                  <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                    {m.examPlacements.map((p) => (
                      <div key={p.id} className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                          📝 {p.exam.title} ({p.exam._count.questions} q.)
                          {p.requireAllLessons && <span className="text-amber-600"> · após todas as aulas</span>}
                        </span>
                        <form action={detachExamPlacement.bind(null, p.id, backPath)}>
                          <button className="text-red-500 hover:underline" type="submit">remover</button>
                        </form>
                      </div>
                    ))}
                    {hasBiblioteca ? (
                      <form action={attachExamToModulo.bind(null, m.id, trilha.id)} className="flex flex-wrap items-center gap-1.5">
                        <select name="examId" required className="input py-1.5 text-xs" defaultValue="">
                          <option value="" disabled>Inserir prova no módulo…</option>
                          {bibliotecaProvas.map((e) => (
                            <option key={e.id} value={e.id}>{e.title}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-slate-500">
                          <input type="checkbox" name="requireAllLessons" className="h-3.5 w-3.5" />
                          após aulas
                        </label>
                        <button className="btn-outline px-2 py-1.5 text-xs" type="submit">inserir</button>
                      </form>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Crie provas na <Link href="/admin/provas" className="underline">biblioteca</Link> para inserir aqui.
                      </p>
                    )}
                  </div>

                  <form action={addAula.bind(null, m.id, trilha.id)} className="space-y-2 border-t border-slate-100 p-3">
                    <input name="title" required className="input" placeholder="Título da aula" />
                    <input name="videoUrl" className="input" placeholder="Link do vídeo (YouTube, Vimeo, Panda...)" />
                    <input name="pdfUrl" className="input" placeholder="Link do PDF (opcional)" />
                    <textarea name="description" className="input" rows={2} placeholder="Descrição (opcional)" />
                    <button className="btn-outline text-sm" type="submit">+ Adicionar aula</button>
                  </form>
                </div>
              ))}
            </div>

            <form action={addModulo.bind(null, trilha.id)} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
              <input name="title" required className="input" placeholder="Nome do novo módulo" />
              <button className="btn-brand" type="submit">Criar módulo</button>
            </form>
          </div>
        </section>

        {/* Prova do produto */}
        <section className="space-y-4">
          <div className="card">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">Prova do produto</h2>
              <Link href="/admin/provas" className="text-xs text-brand hover:underline">
                Biblioteca de provas →
              </Link>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Insira a prova final do produto. É ela que emite o certificado ao ser
              aprovada.
            </p>

            {trilha.examPlacements.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhuma prova inserida no produto.</p>
            )}
            <ul className="mb-4 space-y-2">
              {trilha.examPlacements.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <Link href={`/admin/provas/${p.examId}`} className="text-sm font-medium hover:underline">
                      {p.exam.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {p.exam._count.questions} questão(ões)
                      {p.requireAllLessons && <span className="text-amber-600"> · 🔒 após todas as aulas</span>}
                    </p>
                  </div>
                  <form action={detachExamPlacement.bind(null, p.id, backPath)}>
                    <button className="text-xs text-red-500 hover:underline" type="submit">remover</button>
                  </form>
                </li>
              ))}
            </ul>

            {hasBiblioteca ? (
              <form action={attachExamToTrilha.bind(null, trilha.id)} className="space-y-2 border-t border-slate-100 pt-4">
                <label className="label">Inserir prova da biblioteca</label>
                <select name="examId" required className="input" defaultValue="">
                  <option value="" disabled>Selecione uma prova…</option>
                  {bibliotecaProvas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e._count.questions} q.)
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="requireAllLessons" className="h-4 w-4 rounded border-slate-300" />
                  Só liberar a prova após concluir todas as aulas
                </label>
                <button className="btn-brand" type="submit">Inserir no produto</button>
              </form>
            ) : (
              <div className="border-t border-slate-100 pt-4 text-sm text-slate-500">
                Você ainda não tem provas.{" "}
                <Link href="/admin/provas" className="text-brand underline">
                  Crie uma na biblioteca
                </Link>{" "}
                para inserir aqui.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

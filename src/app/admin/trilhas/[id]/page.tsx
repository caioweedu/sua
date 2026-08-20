import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeCondition } from "@/lib/release";
import SubmitButton from "@/components/SubmitButton";
import ImageUpload from "@/components/ImageUpload";
import ConditionEditor, { type CondOption } from "@/components/ConditionEditor";
import FlashcardsCard from "./flashcards-card";
import {
  addAula,
  updateAula,
  deleteAula,
  addModulo,
  deleteModulo,
  updateModulo,
  updateTrilhaMeta,
  attachExamToTrilha,
  attachExamToModulo,
  detachExamPlacement,
  setReleaseCondition,
  attachCertificateToTrilha,
  updateCertificatePlacement,
  detachCertificatePlacement,
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

  const examInc = {
    include: {
      exam: { select: { title: true, _count: { select: { questions: true } } } },
      releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
    },
  } as const;

  const trilha = await prisma.trilha.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
      modulos: {
        orderBy: { order: "asc" },
        include: {
          aulas: { orderBy: { order: "asc" } },
          examPlacements: examInc,
          releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
        },
      },
      examPlacements: examInc,
      certificatePlacements: {
        include: { template: { select: { name: true } }, releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } } },
      },
      flashcards: { orderBy: { order: "asc" }, select: { id: true, front: true, back: true } },
    },
  });
  if (!trilha) notFound();

  const vitrines = await prisma.vitrine.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  // Candidatos de alvo para condições -----------------------------------
  const outrosProdutos = await prisma.trilha.findMany({
    where: { tenantId: user.tenantId, id: { not: trilha.id } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
  const trilhaOptions: CondOption[] = outrosProdutos.map((t) => ({ id: t.id, label: t.title }));
  const moduloOptions: CondOption[] = trilha.modulos.map((m) => ({ id: m.id, label: m.title }));
  const aulaOptions: CondOption[] = trilha.modulos.flatMap((m) =>
    m.aulas.map((a) => ({ id: a.id, label: `${m.title} · ${a.title}` }))
  );

  // Provas candidatas: colocações dentro da mesma vitrine (referência cruzada).
  const scopeVitrineId = trilha.vitrineId;
  const placementsInScope = await prisma.examPlacement.findMany({
    where: {
      OR: [
        { trilhaId: trilha.id },
        ...(scopeVitrineId
          ? [
              { vitrineId: scopeVitrineId },
              { trilha: { vitrineId: scopeVitrineId } },
              { modulo: { trilha: { vitrineId: scopeVitrineId } } },
            ]
          : []),
      ],
    },
    include: {
      exam: { select: { title: true } },
      trilha: { select: { title: true } },
      modulo: { select: { title: true } },
      vitrine: { select: { name: true } },
    },
  });
  const examOptions: CondOption[] = placementsInScope.map((p) => ({
    id: p.id,
    label: `${p.exam.title} · ${
      p.modulo ? `Módulo ${p.modulo.title}` : p.trilha ? `Produto ${p.trilha.title}` : p.vitrine ? `Vitrine ${p.vitrine.name}` : ""
    }`,
  }));

  // Biblioteca de provas disponível para inserir.
  const bibliotecaProvas = await prisma.exam.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, _count: { select: { questions: true } } },
  });

  // Biblioteca de modelos de certificado disponível para inserir.
  const bibliotecaCertificados = await prisma.certificateTemplate.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const backPath = `/admin/trilhas/${trilha.id}`;
  const hasBiblioteca = bibliotecaProvas.length > 0;

  return (
    <>
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
          <div className="sm:col-span-2">
            <ImageUpload
              name="coverUrl"
              label="Capa do produto (pôster)"
              hint="Retrato 2:3 · recomendado 600×900px · JPG/WebP. Aparece como pôster na home."
              defaultValue={trilha.coverUrl ?? ""}
              slot="produto"
              aspect="2 / 3"
            />
          </div>
          <textarea name="description" defaultValue={trilha.description ?? ""} className="input sm:col-span-2" rows={2} placeholder="Descrição" />
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton>
          </div>
        </form>
      </div>

      {/* Liberação do produto */}
      <div className="card mb-6">
        <h2 className="mb-1 font-semibold">Liberação do produto</h2>
        <p className="mb-3 text-xs text-slate-500">
          Atual: <span className="font-medium text-ink">{describeCondition(trilha.releaseCondition)}</span>
        </p>
        <div className="max-w-md">
          <ConditionEditor
            action={setReleaseCondition.bind(null, "trilha", trilha.id, backPath)}
            current={trilha.releaseCondition}
            exams={examOptions}
            modulos={moduloOptions}
            trilhas={trilhaOptions}
                      aulas={aulaOptions}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Módulos e aulas */}
        <section className="space-y-4">
          <div className="card">
            <h2 className="mb-1 font-semibold">Módulos e aulas</h2>
            <p className="mb-4 text-xs text-slate-500">
              Organize as aulas em módulos. Cada módulo pode ter condição de
              liberação e prova(s).
            </p>

            {trilha.modulos.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhum módulo ainda. Crie o primeiro abaixo.</p>
            )}

            <div className="space-y-4">
              {trilha.modulos.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {m.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.coverUrl} alt="" className="h-6 w-10 rounded object-cover" />
                      )}
                      {m.title}
                    </span>
                    <form action={deleteModulo.bind(null, m.id, trilha.id)}>
                      <button className="text-xs text-red-500 hover:underline" type="submit">
                        remover módulo
                      </button>
                    </form>
                  </div>

                  {/* Capa do módulo (Fatia 2 visual) */}
                  <div className="border-b border-slate-100 px-3 py-2">
                    <details>
                      <summary className="cursor-pointer text-xs text-slate-500">
                        {m.coverUrl ? "trocar capa do módulo" : "adicionar capa do módulo"}
                      </summary>
                      <form action={updateModulo.bind(null, m.id, trilha.id)} className="mt-2 space-y-2">
                        <input name="title" defaultValue={m.title} className="input" placeholder="Título do módulo" />
                        <ImageUpload
                          name="coverUrl"
                          label="Capa do módulo"
                          hint="16:9 · 1600×900px · JPG/WebP. Aparece no topo do módulo no player."
                          defaultValue={m.coverUrl ?? ""}
                          slot="modulo"
                          aspect="16 / 9"
                        />
                        <SubmitButton className="btn-outline text-sm" pendingText="Salvando…">Salvar módulo</SubmitButton>
                      </form>
                    </details>
                  </div>
                  <ul className="divide-y divide-slate-50">
                    {m.aulas.map((a, i) => (
                      <li key={a.id} className="px-3 py-2">
                        <details>
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm">
                            <span>
                              {i + 1}. {a.title}
                              {a.videoUrl && " 🎬"}
                              {a.pdfUrl && " 📎"}
                            </span>
                            <span className="text-xs font-medium text-brand">editar ▾</span>
                          </summary>
                          <form
                            action={updateAula.bind(null, a.id, trilha.id)}
                            className="mt-2 space-y-2"
                          >
                            <input name="title" defaultValue={a.title} className="input" placeholder="Título da aula" />
                            <input name="videoUrl" defaultValue={a.videoUrl ?? ""} className="input" placeholder="Link ou código de incorporação (YouTube, Vimeo, Panda...)" />
                            <input name="pdfUrl" defaultValue={a.pdfUrl ?? ""} className="input" placeholder="Link do material/PDF (opcional)" />
                            <textarea name="description" defaultValue={a.description ?? ""} rows={2} className="input" placeholder="Descrição (opcional)" />
                            <SubmitButton className="btn-outline text-sm" pendingText="Salvando…">
                              Salvar aula
                            </SubmitButton>
                          </form>
                          <form action={deleteAula.bind(null, a.id, trilha.id)} className="mt-1">
                            <button className="text-xs text-red-500 hover:underline" type="submit">
                              remover aula
                            </button>
                          </form>
                        </details>
                      </li>
                    ))}
                    {m.aulas.length === 0 && (
                      <li className="px-3 py-2 text-xs text-slate-400">Sem aulas neste módulo.</li>
                    )}
                  </ul>

                  {/* Liberação do módulo */}
                  <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                    <p className="mb-1 text-xs font-semibold text-slate-500">
                      Liberação: <span className="font-normal">{describeCondition(m.releaseCondition)}</span>
                    </p>
                    <ConditionEditor
                      compact
                      action={setReleaseCondition.bind(null, "modulo", m.id, backPath)}
                      current={m.releaseCondition}
                      exams={examOptions}
                      modulos={moduloOptions.filter((o) => o.id !== m.id)}
                      trilhas={trilhaOptions}
                      aulas={aulaOptions}
                    />
                  </div>

                  {/* Prova do módulo */}
                  <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                    {m.examPlacements.map((p) => (
                      <div key={p.id} className="mb-2 rounded-lg bg-white p-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">
                            📝 {p.exam.title} ({p.exam._count.questions} q.) · {describeCondition(p.releaseCondition)}
                          </span>
                          <form action={detachExamPlacement.bind(null, p.id, backPath)}>
                            <button className="text-red-500 hover:underline" type="submit">remover</button>
                          </form>
                        </div>
                        <div className="mt-1.5">
                          <ConditionEditor
                            compact
                            action={setReleaseCondition.bind(null, "examPlacement", p.id, backPath)}
                            current={p.releaseCondition}
                            exams={examOptions.filter((o) => o.id !== p.id)}
                            modulos={moduloOptions}
                            trilhas={trilhaOptions}
                      aulas={aulaOptions}
                          />
                        </div>
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
                        <SubmitButton className="btn-outline px-2 py-1.5 text-xs" pendingText="…">inserir</SubmitButton>
                      </form>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Crie provas na <Link href="/admin/provas" className="underline">biblioteca</Link> para inserir aqui.
                      </p>
                    )}
                  </div>

                  <form action={addAula.bind(null, m.id, trilha.id)} className="space-y-2 border-t border-slate-100 p-3">
                    <input name="title" required className="input" placeholder="Título da aula" />
                    <input name="videoUrl" className="input" placeholder="Link ou código de incorporação (YouTube, Vimeo, Panda...)" />
                    <input name="pdfUrl" className="input" placeholder="Link do PDF (opcional)" />
                    <textarea name="description" className="input" rows={2} placeholder="Descrição (opcional)" />
                    <SubmitButton className="btn-outline text-sm" pendingText="Adicionando…">+ Adicionar aula</SubmitButton>
                  </form>
                </div>
              ))}
            </div>

            <form action={addModulo.bind(null, trilha.id)} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
              <input name="title" required className="input" placeholder="Nome do novo módulo" />
              <SubmitButton pendingText="Criando…">Criar módulo</SubmitButton>
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
            <ul className="mb-4 space-y-3">
              {trilha.examPlacements.map((p) => (
                <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Link href={`/admin/provas/${p.examId}`} className="text-sm font-medium hover:underline">
                        {p.exam.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {p.exam._count.questions} questão(ões) · {describeCondition(p.releaseCondition)}
                      </p>
                    </div>
                    <form action={detachExamPlacement.bind(null, p.id, backPath)}>
                      <button className="text-xs text-red-500 hover:underline" type="submit">remover</button>
                    </form>
                  </div>
                  <div className="mt-2">
                    <ConditionEditor
                      compact
                      action={setReleaseCondition.bind(null, "examPlacement", p.id, backPath)}
                      current={p.releaseCondition}
                      exams={examOptions.filter((o) => o.id !== p.id)}
                      modulos={moduloOptions}
                      trilhas={trilhaOptions}
                      aulas={aulaOptions}
                    />
                  </div>
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
                <SubmitButton pendingText="Inserindo…">Inserir no produto</SubmitButton>
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

          {/* Certificado do produto */}
          <div className="card">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">Certificado do produto</h2>
              <Link href="/admin/certificados" className="text-xs text-brand hover:underline">
                Modelos de certificado →
              </Link>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Insira um certificado e defina quando ele é liberado. Nome do aluno,
              curso e data entram automáticos.
            </p>

            {trilha.certificatePlacements.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhum certificado inserido.</p>
            )}
            <ul className="mb-4 space-y-3">
              {trilha.certificatePlacements.map((c) => (
                <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{c.template.name}</span>
                      <p className="text-xs text-slate-500">
                        Liberação: {describeCondition(c.releaseCondition)}
                      </p>
                    </div>
                    <form action={detachCertificatePlacement.bind(null, c.id, backPath)}>
                      <button className="text-xs text-red-500 hover:underline" type="submit">remover</button>
                    </form>
                  </div>

                  {/* Campos por produto */}
                  <form action={updateCertificatePlacement.bind(null, c.id, trilha.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input name="professor" defaultValue={c.professor ?? ""} className="input py-1.5 text-xs" placeholder="Ministrado por (professor/instituição)" />
                    <input name="cargaHoraria" defaultValue={c.cargaHoraria ?? ""} className="input py-1.5 text-xs" placeholder="Carga horária" />
                    <input name="assinatura" defaultValue={c.assinatura ?? ""} className="input py-1.5 text-xs sm:col-span-2" placeholder="Assinatura (nome/cargo)" />
                    <textarea name="conteudoProgramatico" defaultValue={c.conteudoProgramatico ?? ""} rows={2} className="input py-1.5 text-xs sm:col-span-2" placeholder="Conteúdo programático (vazio = gera dos módulos/aulas)" />
                    <div className="sm:col-span-2">
                      <SubmitButton className="btn-outline text-xs" pendingText="Salvando…">Salvar campos</SubmitButton>
                    </div>
                  </form>

                  {/* Condição de liberação */}
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="mb-1 text-xs font-semibold text-slate-500">Condição de liberação</p>
                    <ConditionEditor
                      compact
                      action={setReleaseCondition.bind(null, "certificatePlacement", c.id, backPath)}
                      current={c.releaseCondition}
                      exams={examOptions}
                      modulos={moduloOptions}
                      trilhas={trilhaOptions}
                      aulas={aulaOptions}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {bibliotecaCertificados.length > 0 ? (
              <form action={attachCertificateToTrilha.bind(null, trilha.id)} className="space-y-2 border-t border-slate-100 pt-4">
                <label className="label">Inserir certificado</label>
                <select name="templateId" required className="input" defaultValue="">
                  <option value="" disabled>Selecione um modelo…</option>
                  {bibliotecaCertificados.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <input name="professor" className="input" placeholder="Ministrado por (opcional)" />
                <input name="cargaHoraria" className="input" placeholder="Carga horária (opcional)" />
                <input name="assinatura" className="input" placeholder="Assinatura (opcional)" />
                <SubmitButton pendingText="Inserindo…">Inserir no produto</SubmitButton>
                <p className="text-xs text-slate-400">
                  Após inserir, defina a condição de liberação (ex.: após aprovação na prova).
                </p>
              </form>
            ) : (
              <div className="border-t border-slate-100 pt-4 text-sm text-slate-500">
                Nenhum modelo de certificado.{" "}
                <Link href="/admin/certificados" className="text-brand underline">
                  Crie um modelo
                </Link>{" "}
                para inserir aqui.
              </div>
            )}
          </div>

          {/* Flashcards de estudo (Fase 5 — fatia 3) */}
          <FlashcardsCard trilhaId={trilha.id} cards={trilha.flashcards} />
        </section>
      </div>
    </>
  );
}

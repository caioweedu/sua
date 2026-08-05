import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import ImportCard from "./import-card";
import ConditionEditor, { type CondOption } from "@/components/ConditionEditor";
import SubmitButton from "@/components/SubmitButton";
import { describeCondition } from "@/lib/release";
import {
  createTrilha,
  togglePublish,
  updateBranding,
  createDaughter,
  createVitrine,
  deleteVitrine,
  setReleaseCondition,
  attachExamToVitrine,
  detachExamPlacement,
  createAccessProfile,
  deleteAccessProfile,
  createUser,
  assignProfile,
  deleteUser,
} from "@/lib/actions/admin";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const vitrines = await prisma.vitrine.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { trilhas: true } },
      releaseCondition: { include: { clauses: true } },
      examPlacements: {
        include: { exam: { select: { title: true, _count: { select: { questions: true } } } } },
      },
      // Produtos aninhados nesta vitrine (navegação em árvore).
      trilhas: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          published: true,
          _count: { select: { aulas: true, modulos: true } },
        },
      },
    },
  });

  // Biblioteca de provas do tenant (para inserir em vitrines).
  const bibliotecaProvas = await prisma.exam.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, _count: { select: { questions: true } } },
  });

  const trilhas = await prisma.trilha.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { aulas: true } }, vitrine: { select: { name: true } } },
  });
  // Produtos ainda não vinculados a nenhuma vitrine.
  const orphanTrilhas = trilhas.filter((t) => !t.vitrineId);

  const profiles = await prisma.accessProfile.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "asc" },
    include: {
      vitrines: { select: { id: true, name: true } },
      _count: { select: { users: true } },
    },
  });

  const students = await prisma.user.findMany({
    where: { tenantId: user.tenantId, role: "STUDENT" },
    orderBy: { createdAt: "asc" },
    include: { accessProfile: { select: { id: true, name: true } } },
  });

  const isSuper = user.role === "SUPER_ADMIN";
  const daughters = isSuper
    ? await prisma.tenant.findMany({
        where: { type: "DAUGHTER" },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { users: true, trilhas: true } } },
      })
    : [];

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Administração</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/provas" className="btn-outline text-sm">
            📝 Biblioteca de provas
          </Link>
          <Link href="/admin/certificados" className="btn-outline text-sm">
            🏆 Modelos de certificado
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          {/* Estrutura: Vitrine ▸ Produto ▸ (Módulo ▸ Aula/Prova/Certificado dentro do produto) */}
          <div className="card">
            <h2 className="mb-1 font-semibold">Estrutura</h2>
            <p className="mb-4 text-xs text-slate-500">
              Vitrines contêm produtos; cada produto contém módulos, aulas, provas e
              certificado. Clique em um produto para editar o conteúdo dele. O 🔒
              indica uma condição de liberação.
            </p>

            {vitrines.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhuma vitrine ainda. Crie a primeira abaixo.</p>
            )}

            <div className="space-y-3">
              {vitrines.map((v) => (
                <div key={v.id} className="rounded-xl border border-slate-200">
                  {/* Vitrine */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-ink">🗂️ {v.name}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        /{v.slug} · {v._count.trilhas} produto(s)
                      </span>
                      {v.releaseCondition && (
                        <span className="ml-1 text-xs text-amber-600">· 🔒 {describeCondition(v.releaseCondition)}</span>
                      )}
                    </div>
                    <form action={deleteVitrine.bind(null, v.id)}>
                      <button className="shrink-0 text-xs text-red-500 hover:underline" type="submit">remover</button>
                    </form>
                  </div>

                  {/* Produtos da vitrine */}
                  <ul className="divide-y divide-slate-50">
                    {v.trilhas.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 pl-6">
                        <div className="min-w-0">
                          <Link href={`/admin/trilhas/${t.id}`} className="text-sm font-medium hover:underline">
                            📦 {t.title}
                          </Link>
                          <span className="ml-2 text-xs text-slate-400">
                            {t._count.modulos} módulo(s) · {t._count.aulas} aula(s) ·{" "}
                            {t.published ? (
                              <span className="text-green-600">publicado</span>
                            ) : (
                              <span className="text-amber-600">rascunho</span>
                            )}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Link href={`/admin/trilhas/${t.id}`} className="btn-outline px-2 py-1 text-xs">abrir</Link>
                          <form action={togglePublish.bind(null, t.id, !t.published)}>
                            <SubmitButton className="btn-outline px-2 py-1 text-xs" pendingText="…">
                              {t.published ? "Despublicar" : "Publicar"}
                            </SubmitButton>
                          </form>
                        </div>
                      </li>
                    ))}
                    {v.trilhas.length === 0 && (
                      <li className="px-3 py-2 pl-6 text-xs text-slate-400">Nenhum produto nesta vitrine.</li>
                    )}
                  </ul>

                  {/* Novo produto nesta vitrine */}
                  <form action={createTrilha} className="flex gap-2 border-t border-slate-100 p-3 pl-6">
                    <input type="hidden" name="vitrineId" value={v.id} />
                    <input name="title" required className="input py-1.5 text-sm" placeholder="Novo produto nesta vitrine" />
                    <SubmitButton className="btn-brand text-sm" pendingText="Criando…">+ Produto</SubmitButton>
                  </form>

                  {/* Liberação e provas da vitrine (opções avançadas) */}
                  <details className="border-t border-slate-100 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                      Liberação e provas da vitrine
                    </summary>
                    <div className="mt-2">
                      <ConditionEditor
                        compact
                        action={setReleaseCondition.bind(null, "vitrine", v.id, "/admin")}
                        current={v.releaseCondition}
                        exams={v.examPlacements.map((p) => ({ id: p.id, label: p.exam.title }))}
                        modulos={[] as CondOption[]}
                        trilhas={trilhas.map((t) => ({ id: t.id, label: t.title }))}
                      />
                      {v.examPlacements.map((p) => (
                        <div key={p.id} className="mt-1.5 flex items-center justify-between text-xs">
                          <span className="text-slate-600">📝 {p.exam.title} ({p.exam._count.questions} q.)</span>
                          <form action={detachExamPlacement.bind(null, p.id, "/admin")}>
                            <button className="text-red-500 hover:underline" type="submit">remover</button>
                          </form>
                        </div>
                      ))}
                      {bibliotecaProvas.length > 0 && (
                        <form action={attachExamToVitrine.bind(null, v.id)} className="mt-1.5 flex items-center gap-1">
                          <select name="examId" required className="input py-1.5 text-xs" defaultValue="">
                            <option value="" disabled>Inserir prova na vitrine…</option>
                            {bibliotecaProvas.map((e) => (
                              <option key={e.id} value={e.id}>{e.title}</option>
                            ))}
                          </select>
                          <SubmitButton className="btn-outline px-2 py-1.5 text-xs" pendingText="…">inserir</SubmitButton>
                        </form>
                      )}
                    </div>
                  </details>
                </div>
              ))}

              {/* Produtos sem vitrine */}
              {orphanTrilhas.length > 0 && (
                <div className="rounded-xl border border-dashed border-slate-300">
                  <div className="border-b border-slate-100 bg-amber-50/50 px-3 py-2 text-sm font-semibold text-amber-700">
                    ⚠️ Produtos sem vitrine
                  </div>
                  <ul className="divide-y divide-slate-50">
                    {orphanTrilhas.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 pl-6">
                        <Link href={`/admin/trilhas/${t.id}`} className="text-sm font-medium hover:underline">
                          📦 {t.title}
                        </Link>
                        <Link href={`/admin/trilhas/${t.id}`} className="btn-outline px-2 py-1 text-xs">abrir</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Nova vitrine */}
            <form action={createVitrine} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <input name="name" required className="input" placeholder="Nome da nova vitrine" />
              <input name="slug" className="input" placeholder="slug (opcional)" />
              <input name="coverUrl" className="input sm:col-span-2" placeholder="URL da imagem/capa (opcional)" />
              <textarea name="description" className="input sm:col-span-2" rows={2} placeholder="Descrição (opcional)" />
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Criando…">Criar vitrine</SubmitButton>
              </div>
            </form>
          </div>

          {/* Perfis de acesso */}
          <div className="card">
            <h2 className="mb-1 font-semibold">Perfis de acesso</h2>
            <p className="mb-4 text-xs text-slate-500">
              Cada perfil libera um conjunto de vitrines para os alunos vinculados a ele.
            </p>
            {profiles.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhum perfil ainda.</p>
            )}
            <ul className="mb-4 divide-y divide-slate-100">
              {profiles.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <p className="text-xs text-slate-500">
                      {p._count.users} usuário(s) ·{" "}
                      {p.vitrines.length === 0
                        ? "nenhuma vitrine liberada"
                        : p.vitrines.map((v) => v.name).join(", ")}
                    </p>
                  </div>
                  <form action={deleteAccessProfile.bind(null, p.id)}>
                    <button className="text-xs text-red-500 hover:underline" type="submit">
                      remover
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={createAccessProfile} className="space-y-3 border-t border-slate-100 pt-4">
              <input name="name" required className="input" placeholder="Nome do perfil (ex: Time Operacional)" />
              <textarea name="description" className="input" rows={2} placeholder="Descrição (opcional)" />
              <div>
                <label className="label">Vitrines liberadas</label>
                {vitrines.length === 0 ? (
                  <p className="text-xs text-slate-500">Crie uma vitrine primeiro.</p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {vitrines.map((v) => (
                      <label key={v.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="vitrineIds" value={v.id} className="h-4 w-4 rounded border-slate-300" />
                        {v.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <SubmitButton pendingText="Criando…">Criar perfil</SubmitButton>
            </form>
          </div>

          {/* Usuários */}
          <div className="card">
            <h2 className="mb-1 font-semibold">Usuários (alunos)</h2>
            <p className="mb-4 text-xs text-slate-500">
              Vincule cada aluno a um perfil para controlar o que ele acessa.
            </p>
            {students.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhum aluno ainda.</p>
            )}
            <ul className="mb-4 divide-y divide-slate-100">
              {students.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <span className="font-medium">{s.name}</span>
                    <p className="truncate text-xs text-slate-500">{s.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={assignProfile.bind(null, s.id)} className="flex items-center gap-1">
                      <select
                        name="accessProfileId"
                        defaultValue={s.accessProfile?.id ?? ""}
                        className="input py-1.5 text-sm"
                      >
                        <option value="">Acesso total</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button className="btn-outline px-2 py-1.5 text-xs" type="submit">salvar</button>
                    </form>
                    <form action={deleteUser.bind(null, s.id)}>
                      <button className="text-xs text-red-500 hover:underline" type="submit">
                        remover
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            <form action={createUser} className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <input name="name" required className="input" placeholder="Nome do aluno" />
              <input name="email" type="email" required className="input" placeholder="E-mail" />
              <input name="password" type="password" required minLength={6} className="input" placeholder="Senha (mín. 6)" />
              <select name="accessProfileId" className="input" defaultValue="">
                <option value="">Acesso total (sem perfil)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Criando…">Criar aluno</SubmitButton>
              </div>
            </form>
          </div>
        </section>

        {/* Importação + Aparência + filhas */}
        <section className="space-y-4">
          <ImportCard />

          <div className="card">
            <h2 className="mb-4 font-semibold">Aparência</h2>
            <form action={updateBranding} className="space-y-3">
              <div>
                <label className="label">Cor principal</label>
                <input name="brandColor" type="color" defaultValue={user.tenant.brandColor} className="h-10 w-full rounded-lg border border-slate-300" />
              </div>
              <div>
                <label className="label">Cor do texto sobre a cor principal</label>
                <input name="brandFgColor" type="color" defaultValue={user.tenant.brandFgColor} className="h-10 w-full rounded-lg border border-slate-300" />
              </div>
              <input name="logoUrl" defaultValue={user.tenant.logoUrl ?? ""} className="input" placeholder="URL do logo" />
              <input name="bannerUrl" defaultValue={user.tenant.bannerUrl ?? ""} className="input" placeholder="URL do banner de entrada" />
              <input name="certificateBg" defaultValue={user.tenant.certificateBg ?? ""} className="input" placeholder="URL do fundo do certificado" />
              <input name="certificateSignature" defaultValue={user.tenant.certificateSignature ?? ""} className="input" placeholder="Assinatura do certificado" />
              <SubmitButton pendingText="Salvando…">Salvar aparência</SubmitButton>
            </form>
          </div>

          {isSuper && (
            <>
              <div className="card">
                <h2 className="mb-1 font-semibold">Universidades filhas</h2>
                <p className="mb-4 text-xs text-slate-500">
                  {daughters.length} cliente(s) white-label
                </p>
                <ul className="divide-y divide-slate-100 text-sm">
                  {daughters.map((d) => (
                    <li key={d.id} className="py-2">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-slate-400"> · {d.slug}</span>
                      <p className="text-xs text-slate-500">
                        {d._count.users} usuário(s) · {d._count.trilhas} produto(s)
                        {d.customDomain && ` · ${d.customDomain}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <h2 className="mb-4 font-semibold">Nova filha (white-label)</h2>
                <form action={createDaughter} className="space-y-3">
                  <input name="name" required className="input" placeholder="Nome da universidade" />
                  <input name="slug" required className="input" placeholder="slug (ex: cliente-x)" />
                  <input name="customDomain" className="input" placeholder="Domínio próprio (opcional)" />
                  <input name="brandColor" type="color" defaultValue="#2563eb" className="h-10 w-full rounded-lg border border-slate-300" />
                  <hr className="border-slate-100" />
                  <input name="adminEmail" type="email" required className="input" placeholder="E-mail do admin da filha" />
                  <input name="adminPassword" type="password" required minLength={6} className="input" placeholder="Senha do admin (mín. 6)" />
                  <SubmitButton pendingText="Criando…">Criar filha</SubmitButton>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

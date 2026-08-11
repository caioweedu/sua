import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import ImportCard from "./import-card";
import ConditionEditor, { type CondOption } from "@/components/ConditionEditor";
import SubmitButton from "@/components/SubmitButton";
import ImageUpload from "@/components/ImageUpload";
import { describeCondition } from "@/lib/release";
import { hiddenSharedVitrineIds } from "@/lib/access";
import {
  createTrilha,
  togglePublish,
  updateBranding,
  createDaughter,
  updateDaughter,
  saveSharedVisibility,
  createVitrine,
  deleteVitrine,
  setReleaseCondition,
  attachExamToVitrine,
  detachExamPlacement,
  createAccessProfile,
  updateAccessProfile,
  deleteAccessProfile,
  createUser,
  deleteUser,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  moveHeroSlide,
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
      releaseCondition: { include: { clauses: { orderBy: { order: "asc" } } } },
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

  const heroSlides = await prisma.heroSlide.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  // Conteúdo herdado da mãe (só para filhas): vitrines compartilhadas pela
  // Weedu, exibidas em modo leitura e disponíveis para os perfis de acesso.
  const isDaughter = user.tenant.type === "DAUGHTER" && !!user.tenant.parentId;
  const sharedVitrines = isDaughter
    ? await prisma.vitrine.findMany({
        where: { tenantId: user.tenant.parentId!, published: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          trilhas: {
            where: { published: true },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            select: { id: true, title: true },
          },
        },
      })
    : [];

  // Vitrines herdadas que esta filha optou por ocultar (opt-out).
  const hiddenShared = isDaughter ? await hiddenSharedVitrineIds(user.tenant) : [];
  const hiddenSet = new Set(hiddenShared);

  // Opções de vitrine para os perfis de acesso: as próprias + as compartilhadas
  // da Weedu que NÃO foram ocultadas (marcadas com "(Weedu)").
  const profileVitrineOptions = [
    ...vitrines.map((v) => ({ id: v.id, label: v.name })),
    ...sharedVitrines
      .filter((v) => !hiddenSet.has(v.id))
      .map((v) => ({ id: v.id, label: `${v.name} (Weedu)` })),
  ];

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
          <Link href="/admin/copiloto" className="btn-brand text-sm">
            ✨ Copiloto de criação
          </Link>
          <Link href="/admin/analytics" className="btn-outline text-sm">
            📊 Resultados
          </Link>
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

            {/* Conteúdo compartilhado da Weedu — a filha escolhe o que herdar */}
            {sharedVitrines.length > 0 && (
              <form
                action={saveSharedVisibility}
                className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40"
              >
                <div className="border-b border-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-700">
                  🔗 Conteúdo compartilhado pela Weedu
                </div>
                <p className="px-3 pt-2 text-xs text-slate-500">
                  Marque o que deve aparecer nesta universidade. O que estiver desmarcado
                  não é herdado (some para os alunos e some dos perfis de acesso). Este
                  conteúdo é gerenciado pela Weedu — aqui você só escolhe se herda ou não.
                </p>
                <ul className="divide-y divide-indigo-50">
                  {sharedVitrines.map((v) => (
                    <li key={v.id} className="px-3 py-2">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          name="visibleVitrineIds"
                          value={v.id}
                          defaultChecked={!hiddenSet.has(v.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span className="min-w-0">
                          <span className="text-sm font-medium text-ink">🗂️ {v.name}</span>
                          <span className="ml-2 text-xs text-slate-400">
                            {v.trilhas.length} produto(s)
                          </span>
                          {v.trilhas.length > 0 && (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {v.trilhas.map((t) => t.title).join(" · ")}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="px-3 py-2">
                  <SubmitButton className="btn-outline text-sm" pendingText="Salvando…">
                    Salvar conteúdo herdado
                  </SubmitButton>
                </div>
              </form>
            )}

            {/* Nova vitrine */}
            <form action={createVitrine} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <input name="name" required className="input" placeholder="Nome da nova vitrine" />
              <input name="slug" className="input" placeholder="slug (opcional)" />
              <div className="sm:col-span-2">
                <ImageUpload
                  name="coverUrl"
                  label="Capa/banner da vitrine"
                  hint="16:9 · recomendado 1600×900px · JPG/WebP."
                  slot="vitrine"
                  aspect="16 / 9"
                />
              </div>
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
                <li key={p.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
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
                  </div>

                  {/* Editar perfil: nome, descrição e vitrines liberadas */}
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-xs font-medium text-brand">editar</summary>
                    <form action={updateAccessProfile.bind(null, p.id)} className="mt-2 space-y-2">
                      <input name="name" defaultValue={p.name} required className="input py-1.5 text-sm" placeholder="Nome do perfil" />
                      <div>
                        <label className="label text-xs">Vitrines liberadas</label>
                        {profileVitrineOptions.length === 0 ? (
                          <p className="text-xs text-slate-500">Crie uma vitrine primeiro.</p>
                        ) : (
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {profileVitrineOptions.map((v) => (
                              <label key={v.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  name="vitrineIds"
                                  value={v.id}
                                  defaultChecked={p.vitrines.some((pv) => pv.id === v.id)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                {v.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <SubmitButton className="btn-outline text-sm" pendingText="Salvando…">Salvar perfil</SubmitButton>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
            <form action={createAccessProfile} className="space-y-3 border-t border-slate-100 pt-4">
              <input name="name" required className="input" placeholder="Nome do perfil (ex: Time Operacional)" />
              <textarea name="description" className="input" rows={2} placeholder="Descrição (opcional)" />
              <div>
                <label className="label">Vitrines liberadas</label>
                {profileVitrineOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">Crie uma vitrine primeiro.</p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {profileVitrineOptions.map((v) => (
                      <label key={v.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="vitrineIds" value={v.id} className="h-4 w-4 rounded border-slate-300" />
                        {v.label}
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
                    {!s.active && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">inativo</span>
                    )}
                    <p className="truncate text-xs text-slate-500">
                      {s.email} · {s.accessProfile?.name ?? "Acesso total"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/alunos/${s.id}`} className="btn-outline px-2 py-1 text-xs">
                      editar
                    </Link>
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
              <div>
                <label className="label">Tema da área do aluno</label>
                <p className="-mt-1 mb-2 text-xs text-slate-500">
                  Escuro = imersivo estilo streaming. Claro = fundo branco.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: "dark", t: "Escuro", desc: "Netflix/Prime" },
                    { v: "light", t: "Claro", desc: "Fundo branco" },
                  ].map((o) => (
                    <label
                      key={o.v}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50"
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={o.v}
                        defaultChecked={(user.tenant.theme ?? "dark") === o.v}
                      />
                      <span>
                        <span className="font-medium">{o.t}</span>
                        <span className="block text-xs text-slate-400">{o.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <ImageUpload
                name="logoUrl"
                label="Logo"
                hint="PNG com fundo transparente · altura ~64px · até 400×120px."
                defaultValue={user.tenant.logoUrl ?? ""}
                slot="logo"
                aspect="3 / 1"
              />
              <ImageUpload
                name="bannerUrl"
                label="Banner de entrada (home)"
                hint="16:9 · recomendado 1600×900px (mín. 1280×720) · JPG/WebP."
                defaultValue={user.tenant.bannerUrl ?? ""}
                slot="banner"
                aspect="16 / 9"
              />
              <ImageUpload
                name="certificateBg"
                label="Fundo do certificado"
                hint="A4 paisagem · 3508×2480px (300dpi) · PNG/JPG."
                defaultValue={user.tenant.certificateBg ?? ""}
                slot="certificado"
                aspect="1.414 / 1"
              />
              <input name="certificateSignature" defaultValue={user.tenant.certificateSignature ?? ""} className="input" placeholder="Assinatura do certificado" />
              <SubmitButton pendingText="Salvando…">Salvar aparência</SubmitButton>
            </form>
          </div>

          {/* Banner rotativo da home (hero) */}
          <div className="card">
            <h2 className="mb-1 font-semibold">Banner rotativo da home</h2>
            <p className="mb-4 text-xs text-slate-500">
              Slides que giram no topo da home do aluno. Imagem + texto e link
              opcionais. Recomendado 1600×900px (16:9).
            </p>

            {heroSlides.length > 0 && (
              <ul className="mb-4 space-y-3">
                {heroSlides.map((s, idx) => (
                  <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.imageUrl}
                        alt=""
                        className="h-14 w-24 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.title || <span className="text-slate-400">(sem título)</span>}
                          {!s.active && (
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              oculto
                            </span>
                          )}
                        </p>
                        {s.subtitle && <p className="truncate text-xs text-slate-500">{s.subtitle}</p>}
                        {s.ctaHref && (
                          <p className="truncate text-xs text-brand">
                            {s.ctaLabel ? `${s.ctaLabel} → ` : "→ "}
                            {s.ctaHref}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex gap-1">
                          <form action={moveHeroSlide.bind(null, s.id, "up")}>
                            <button className="rounded border border-slate-200 px-1.5 text-xs disabled:opacity-30" disabled={idx === 0} type="submit">↑</button>
                          </form>
                          <form action={moveHeroSlide.bind(null, s.id, "down")}>
                            <button className="rounded border border-slate-200 px-1.5 text-xs disabled:opacity-30" disabled={idx === heroSlides.length - 1} type="submit">↓</button>
                          </form>
                          <form action={deleteHeroSlide.bind(null, s.id)}>
                            <button className="rounded border border-slate-200 px-1.5 text-xs text-red-500" type="submit">remover</button>
                          </form>
                        </div>
                      </div>
                    </div>

                    {/* Editar slide */}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-slate-500">editar</summary>
                      <form action={updateHeroSlide.bind(null, s.id)} className="mt-2 space-y-2">
                        <ImageUpload
                          name="imageUrl"
                          label="Imagem do slide"
                          hint="16:9 · 1600×900px · JPG/WebP."
                          defaultValue={s.imageUrl}
                          slot="hero"
                          aspect="16 / 9"
                        />
                        <input name="title" defaultValue={s.title ?? ""} className="input" placeholder="Título (opcional)" />
                        <input name="subtitle" defaultValue={s.subtitle ?? ""} className="input" placeholder="Subtítulo (opcional)" />
                        <div className="grid grid-cols-2 gap-2">
                          <input name="ctaLabel" defaultValue={s.ctaLabel ?? ""} className="input" placeholder="Texto do botão" />
                          <input name="ctaHref" defaultValue={s.ctaHref ?? ""} className="input" placeholder="Link (ex.: /vitrines/... ou https://)" />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" name="active" defaultChecked={s.active} /> Ativo (visível na home)
                        </label>
                        <SubmitButton pendingText="Salvando…">Salvar slide</SubmitButton>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}

            {/* Novo slide */}
            <form action={createHeroSlide} className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium">Novo slide</p>
              <ImageUpload
                name="imageUrl"
                label="Imagem do slide"
                hint="16:9 · 1600×900px · JPG/WebP."
                slot="hero"
                aspect="16 / 9"
              />
              <input name="title" className="input" placeholder="Título (opcional)" />
              <input name="subtitle" className="input" placeholder="Subtítulo (opcional)" />
              <div className="grid grid-cols-2 gap-2">
                <input name="ctaLabel" className="input" placeholder="Texto do botão (opcional)" />
                <input name="ctaHref" className="input" placeholder="Link (ex.: /vitrines/ID ou https://)" />
              </div>
              <SubmitButton pendingText="Adicionando…">+ Adicionar slide</SubmitButton>
            </form>
          </div>

          {isSuper && (
            <>
              <div className="card">
                <h2 className="mb-1 font-semibold">Universidades filhas</h2>
                <p className="mb-4 text-xs text-slate-500">
                  {daughters.length} cliente(s) white-label
                </p>
                <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Para acessar uma filha sem domínio próprio, use o link
                  <span className="font-medium"> Acessar</span> (guarda a filha por 1 dia).
                  Faça <span className="font-medium">logout</span> antes, e entre com o admin da filha.
                </p>
                <ul className="divide-y divide-slate-100 text-sm">
                  {daughters.map((d) => (
                    <li key={d.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium">{d.name}</span>
                          {!d.active && (
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">inativa</span>
                          )}
                          <span className="text-slate-400"> · {d.slug}</span>
                          <p className="text-xs text-slate-500">
                            {d._count.users} usuário(s) · {d._count.trilhas} produto(s)
                            {d.customDomain && ` · ${d.customDomain}`}
                          </p>
                        </div>
                        <a
                          href={`/login?tenant=${d.slug}`}
                          className="btn-outline shrink-0 px-2 py-1 text-xs"
                        >
                          Acessar ↗
                        </a>
                      </div>

                      {/* Editar filha */}
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-xs font-medium text-brand">editar</summary>
                        <form action={updateDaughter.bind(null, d.id)} className="mt-2 space-y-2">
                          <input name="name" defaultValue={d.name} required className="input py-1.5 text-sm" placeholder="Nome da filha" />
                          <input name="slug" defaultValue={d.slug} required className="input py-1.5 text-sm" placeholder="slug (ex: cliente-x)" />
                          <input name="customDomain" defaultValue={d.customDomain ?? ""} className="input py-1.5 text-sm" placeholder="Domínio próprio (opcional)" />
                          <div className="flex items-center gap-2">
                            <label className="label mb-0 text-xs">Cor</label>
                            <input name="brandColor" type="color" defaultValue={d.brandColor} className="h-8 w-12 rounded border border-slate-300" />
                            <label className="ml-3 flex items-center gap-1.5 text-sm text-slate-600">
                              <input type="checkbox" name="active" defaultChecked={d.active} /> Ativa
                            </label>
                          </div>
                          <SubmitButton className="btn-outline text-sm" pendingText="Salvando…">Salvar filha</SubmitButton>
                        </form>
                      </details>
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

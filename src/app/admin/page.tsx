import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import ImportCard from "./import-card";
import ConditionEditor, { type CondOption } from "@/components/ConditionEditor";
import SubmitButton from "@/components/SubmitButton";
import ImageUpload from "@/components/ImageUpload";
import { describeCondition } from "@/lib/release";
import { grantedSharedVitrineIds } from "@/lib/access";
import {
  createTrilha,
  togglePublish,
  updateGamificationSettings,
  createDaughter,
  updateDaughter,
  saveDaughterGrants,
  createVitrine,
  deleteVitrine,
  updateVitrine,
  setReleaseCondition,
  attachExamToVitrine,
  detachExamPlacement,
  createAccessProfile,
  updateAccessProfile,
  deleteAccessProfile,
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

  // Vitrines da Weedu LIBERADAS para esta filha (só essas ela pode usar).
  const grantedShared = isDaughter ? await grantedSharedVitrineIds(user.tenant) : [];
  const grantedSet = new Set(grantedShared);
  const receivedVitrines = sharedVitrines.filter((v) => grantedSet.has(v.id));

  // Opções de vitrine para os perfis de acesso: as próprias + as liberadas pela
  // Weedu (marcadas com "(Weedu)").
  const profileVitrineOptions = [
    ...vitrines.map((v) => ({ id: v.id, label: v.name })),
    ...receivedVitrines.map((v) => ({ id: v.id, label: `${v.name} (Weedu)` })),
  ];

  const isSuper = user.role === "SUPER_ADMIN";
  const daughters = isSuper
    ? await prisma.tenant.findMany({
        where: { type: "DAUGHTER" },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { users: true, trilhas: true } } },
      })
    : [];
  // Liberações de conteúdo por filha (para o painel da Weedu): filha → set de
  // ids de vitrines da mãe liberadas.
  const grantsByDaughter = new Map<string, Set<string>>();
  if (isSuper && daughters.length > 0) {
    const grants = await prisma.sharedVitrineGrant.findMany({
      where: { tenantId: { in: daughters.map((d) => d.id) } },
      select: { tenantId: true, vitrineId: true },
    });
    for (const g of grants) {
      if (!grantsByDaughter.has(g.tenantId)) grantsByDaughter.set(g.tenantId, new Set());
      grantsByDaughter.get(g.tenantId)!.add(g.vitrineId);
    }
  }

  return (
    <AdminShell user={user} tenant={user.tenant}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Conteúdo</h1>
          <p className="text-sm text-slate-500">Vitrines, produtos e perfis de acesso.</p>
        </div>
        <Link href="/admin/copiloto" className="btn-brand text-sm">
          ✨ Copiloto de criação
        </Link>
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

                  {/* Editar vitrine (nome, descrição, capa e banner) */}
                  <details className="border-b border-slate-100 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                      Editar vitrine (nome, capa e banner)
                    </summary>
                    <form action={updateVitrine.bind(null, v.id)} className="mt-2 space-y-2">
                      <input name="name" defaultValue={v.name} className="input py-1.5 text-sm" placeholder="Nome da vitrine" />
                      <textarea name="description" defaultValue={v.description ?? ""} className="input py-1.5 text-sm" rows={2} placeholder="Descrição (opcional)" />
                      <ImageUpload
                        name="coverUrl"
                        label="Capa (card da vitrine)"
                        hint="16:9 · recomendado 1600×900px · JPG/WebP."
                        defaultValue={v.coverUrl ?? ""}
                        slot="vitrine"
                        aspect="16 / 9"
                      />
                      <ImageUpload
                        name="bannerUrl"
                        label="Banner (topo da página da vitrine)"
                        hint="16:9 · recomendado 1600×900px · JPG/WebP."
                        defaultValue={v.bannerUrl ?? ""}
                        slot="vitrine"
                        aspect="16 / 9"
                      />
                      <SubmitButton className="btn-outline text-sm" pendingText="Salvando…">Salvar vitrine</SubmitButton>
                    </form>
                  </details>

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

            {/* Conteúdo liberado pela Weedu (só leitura — quem controla é a Weedu) */}
            {isDaughter && (
              <div className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40">
                <div className="border-b border-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-700">
                  🔗 Conteúdo liberado pela Weedu
                </div>
                {receivedVitrines.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-500">
                    A Weedu ainda não liberou nenhum conteúdo para esta universidade.
                  </p>
                ) : (
                  <>
                    <ul className="divide-y divide-indigo-50">
                      {receivedVitrines.map((v) => (
                        <li key={v.id} className="px-3 py-2">
                          <span className="text-sm font-medium text-ink">🗂️ {v.name}</span>
                          <span className="ml-2 text-xs text-slate-400">
                            {v.trilhas.length} produto(s)
                          </span>
                          {v.trilhas.length > 0 && (
                            <p className="mt-0.5 pl-6 text-xs text-slate-500">
                              {v.trilhas.map((t) => t.title).join(" · ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="px-3 py-2 text-xs text-slate-500">
                      Gerenciado pela Weedu. Use os <strong>perfis de acesso</strong> acima para
                      definir quais alunos veem cada um.
                    </p>
                  </>
                )}
              </div>
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

        </section>

        {/* Importação de conteúdo + gamificação + filhas */}
        <section className="space-y-4">
          <ImportCard />

          {/* Gamificação (Onda 2, Fatia 5) */}
          <div className="card">
            <h2 className="mb-1 font-semibold">Gamificação</h2>
            <p className="mb-4 text-xs text-slate-500">
              XP, níveis, conquistas e ofensiva no painel do aluno. O ranking
              mostra o nome dos alunos — desligue se preferir manter privado.
            </p>
            {user.tenant.gamificationEntitled ? (
              <form action={updateGamificationSettings} className="space-y-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                  <input
                    type="checkbox"
                    name="gamificationEnabled"
                    defaultChecked={user.tenant.gamificationEnabled}
                    className="h-4 w-4"
                  />
                  <span>
                    <span className="font-medium">Ativar gamificação</span>
                    <span className="block text-xs text-slate-400">
                      XP, níveis, conquistas e ofensiva.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                  <input
                    type="checkbox"
                    name="rankingEnabled"
                    defaultChecked={user.tenant.rankingEnabled}
                    className="h-4 w-4"
                  />
                  <span>
                    <span className="font-medium">Mostrar ranking da turma</span>
                    <span className="block text-xs text-slate-400">
                      Placar por XP com nomes dos alunos.
                    </span>
                  </span>
                </label>
                <SubmitButton pendingText="Salvando…">Salvar gamificação</SubmitButton>
              </form>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
                🔒 O módulo de gamificação não está liberado para esta universidade.
                Fale com a Weedu para habilitar.
              </p>
            )}
            {user.role === "SUPER_ADMIN" && (
              <Link
                href="/admin/niveis"
                className="mt-3 inline-block text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                🎨 Personalizar ícones dos níveis →
              </Link>
            )}
          </div>

          {/* Aparência e banner rotativo movidos para /admin/aparencia. */}

          {isSuper && (
            <>
              <div className="card">
                <h2 className="mb-1 font-semibold">Universidades filhas</h2>
                <p className="mb-4 text-xs text-slate-500">
                  {daughters.length} cliente(s) white-label
                </p>
                <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Clique em <span className="font-medium">Acessar</span> para entrar como aquela
                  filha (você vê e edita o painel dela). Um aviso aparece no topo com o botão
                  <span className="font-medium"> Voltar para a Weedu</span> para sair.
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
                          href={`/admin?tenant=${d.slug}`}
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
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Módulos liberados</p>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" name="gamificationEntitled" defaultChecked={d.gamificationEntitled} /> 🎮 Gamificação (liberada)
                            </label>
                            <p className="mt-1 text-[11px] text-slate-400">
                              O módulo de RH aparecerá aqui no mesmo formato quando for lançado.
                            </p>
                          </div>
                          <SubmitButton className="btn-outline text-sm" pendingText="Salvando…">Salvar filha</SubmitButton>
                        </form>
                      </details>

                      {/* Conteúdo liberado para esta filha (controle da Weedu) */}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs font-medium text-indigo-600">
                          conteúdo liberado ({grantsByDaughter.get(d.id)?.size ?? 0})
                        </summary>
                        {vitrines.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Crie vitrines na Weedu para poder liberá-las.
                          </p>
                        ) : (
                          <form action={saveDaughterGrants.bind(null, d.id)} className="mt-2 space-y-2">
                            <p className="text-xs text-slate-500">
                              Marque as vitrines da Weedu que <strong>{d.name}</strong> recebe.
                            </p>
                            <div className="grid gap-1.5">
                              {vitrines.map((v) => (
                                <label key={v.id} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    name="grantVitrineIds"
                                    value={v.id}
                                    defaultChecked={grantsByDaughter.get(d.id)?.has(v.id) ?? false}
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                  {v.name}
                                </label>
                              ))}
                            </div>
                            <SubmitButton className="btn-outline text-sm" pendingText="Salvando…">
                              Salvar liberação
                            </SubmitButton>
                          </form>
                        )}
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
    </AdminShell>
  );
}

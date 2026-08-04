import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import ImportCard from "./import-card";
import {
  createTrilha,
  togglePublish,
  updateBranding,
  createDaughter,
  createVitrine,
  deleteVitrine,
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
    include: { _count: { select: { trilhas: true } } },
  });

  const trilhas = await prisma.trilha.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { aulas: true } }, vitrine: { select: { name: true } } },
  });

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
      <h1 className="mb-6 text-2xl font-bold">Administração</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          {/* Vitrines */}
          <div className="card">
            <h2 className="mb-1 font-semibold">Vitrines</h2>
            <p className="mb-4 text-xs text-slate-500">Áreas que agrupam os treinamentos.</p>
            {vitrines.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhuma vitrine ainda.</p>
            )}
            <ul className="mb-4 divide-y divide-slate-100">
              {vitrines.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-medium">{v.name}</span>
                    <p className="text-xs text-slate-500">
                      {v._count.trilhas} produto(s) · /{v.slug}
                    </p>
                  </div>
                  <form action={deleteVitrine.bind(null, v.id)}>
                    <button className="text-xs text-red-500 hover:underline" type="submit">
                      remover
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={createVitrine} className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <input name="name" required className="input" placeholder="Nome da vitrine" />
              <input name="slug" className="input" placeholder="slug (opcional)" />
              <input name="coverUrl" className="input sm:col-span-2" placeholder="URL da imagem/capa (opcional)" />
              <textarea name="description" className="input sm:col-span-2" rows={2} placeholder="Descrição (opcional)" />
              <div className="sm:col-span-2">
                <button className="btn-brand" type="submit">Criar vitrine</button>
              </div>
            </form>
          </div>

          {/* Produtos */}
          <div className="card">
            <h2 className="mb-4 font-semibold">Produtos (treinamentos)</h2>
            {trilhas.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhum produto ainda.</p>
            )}
            <ul className="mb-4 divide-y divide-slate-100">
              {trilhas.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/admin/trilhas/${t.id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {t.vitrine ? t.vitrine.name : <span className="text-amber-600">sem vitrine</span>}
                      {" · "}{t._count.aulas} aula(s) ·{" "}
                      {t.published ? (
                        <span className="text-green-600">publicado</span>
                      ) : (
                        <span className="text-amber-600">rascunho</span>
                      )}
                    </p>
                  </div>
                  <form action={togglePublish.bind(null, t.id, !t.published)}>
                    <button className="btn-outline text-sm" type="submit">
                      {t.published ? "Despublicar" : "Publicar"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={createTrilha} className="space-y-3 border-t border-slate-100 pt-4">
              <input name="title" required className="input" placeholder="Título do treinamento" />
              <select name="vitrineId" className="input" defaultValue="">
                <option value="">Sem vitrine</option>
                {vitrines.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <textarea name="description" className="input" placeholder="Descrição" rows={2} />
              <input name="coverUrl" className="input" placeholder="URL da capa (opcional)" />
              <button className="btn-brand" type="submit">Criar produto</button>
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
              <button className="btn-brand" type="submit">Criar perfil</button>
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
                <button className="btn-brand" type="submit">Criar aluno</button>
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
              <button className="btn-brand" type="submit">Salvar aparência</button>
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
                  <button className="btn-brand" type="submit">Criar filha</button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

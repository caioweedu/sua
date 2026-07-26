import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import {
  createTrilha,
  togglePublish,
  updateBranding,
  createDaughter,
} from "@/lib/actions/admin";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const trilhas = await prisma.trilha.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { aulas: true } } },
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
        {/* Trilhas */}
        <section className="lg:col-span-2 space-y-4">
          <div className="card">
            <h2 className="mb-4 font-semibold">Trilhas</h2>
            {trilhas.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhuma trilha ainda.</p>
            )}
            <ul className="divide-y divide-slate-100">
              {trilhas.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/admin/trilhas/${t.id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {t._count.aulas} aula(s) ·{" "}
                      {t.published ? (
                        <span className="text-green-600">publicada</span>
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
          </div>

          <div className="card">
            <h2 className="mb-4 font-semibold">Nova trilha</h2>
            <form action={createTrilha} className="space-y-3">
              <input name="title" required className="input" placeholder="Título da trilha" />
              <textarea name="description" className="input" placeholder="Descrição" rows={2} />
              <input name="coverUrl" className="input" placeholder="URL da capa (opcional)" />
              <button className="btn-brand" type="submit">
                Criar trilha
              </button>
            </form>
          </div>
        </section>

        {/* Branding + filhas */}
        <section className="space-y-4">
          <div className="card">
            <h2 className="mb-4 font-semibold">Identidade visual</h2>
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
              <input name="certificateBg" defaultValue={user.tenant.certificateBg ?? ""} className="input" placeholder="URL do fundo do certificado" />
              <input name="certificateSignature" defaultValue={user.tenant.certificateSignature ?? ""} className="input" placeholder="Assinatura do certificado" />
              <button className="btn-brand" type="submit">
                Salvar identidade
              </button>
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
                        {d._count.users} usuário(s) · {d._count.trilhas} trilha(s)
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
                  <button className="btn-brand" type="submit">
                    Criar filha
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

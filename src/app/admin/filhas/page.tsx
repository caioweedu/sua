import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createDaughter, updateDaughter, saveDaughterGrants } from "@/lib/actions/admin";
import AdminShell from "@/components/AdminShell";
import SubmitButton from "@/components/SubmitButton";

// Onda 3 · Navegação — Universidades filhas (white-label). Só a Weedu
// (SUPER_ADMIN) gerencia: criar, editar e liberar conteúdo para cada filha.
export default async function FilhasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") redirect("/admin");

  const daughters = await prisma.tenant.findMany({
    where: { type: "DAUGHTER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, trilhas: true } } },
  });

  // Vitrines da mãe (para liberar por filha) + liberações atuais.
  const vitrines = await prisma.vitrine.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
  const grantsByDaughter = new Map<string, Set<string>>();
  if (daughters.length > 0) {
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Universidades filhas</h1>
        <p className="text-sm text-slate-500">
          {daughters.length} cliente(s) white-label. Criar, editar e liberar conteúdo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="card">
            <h2 className="mb-1 font-semibold">Filhas</h2>
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Clique em <span className="font-medium">Acessar</span> para entrar como aquela
              filha (você vê e edita o painel dela). Um aviso aparece no topo com o botão
              <span className="font-medium"> Voltar para a Weedu</span> para sair.
            </p>
            {daughters.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma filha ainda. Crie a primeira ao lado.</p>
            ) : (
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
            )}
          </div>
        </section>

        <section>
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
        </section>
      </div>
    </AdminShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import SubmitButton from "@/components/SubmitButton";
import {
  createTeam,
  renameTeam,
  deleteTeam,
  moveTeam,
  setTeamLead,
  removeTeamLead,
  assignMember,
  removeMember,
} from "@/lib/actions/teams";

// Onda 3 — Gestão de Equipes & RH · Fatia F0.
// Admin do organograma: monta a árvore de equipes (Departamento ▸ Setor ▸
// Turma), define gestor/supervisor de cada equipe e aloca as pessoas. Esta é a
// FUNDAÇÃO — os dashboards de RH/gestor (F1/F2) leem esta estrutura depois.

export default async function EquipesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const teams = await prisma.team.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      leads: { include: { user: { select: { id: true, name: true } } } },
      members: {
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      },
    },
  });

  // Todas as pessoas do tenant (para os seletores de liderança e alocação).
  const people = await prisma.user.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, teamId: true },
  });

  const unassigned = people.filter((p) => !p.teamId);
  const totalPeople = people.length;
  const inTeams = people.filter((p) => p.teamId).length;

  // Índice pai → filhos, para renderizar a árvore.
  const childrenOf = new Map<string | null, typeof teams>();
  for (const t of teams) {
    const key = t.parentId ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, [] as typeof teams);
    childrenOf.get(key)!.push(t);
  }
  const roots = childrenOf.get(null) ?? [];

  // Opções de "equipe-mãe" para criar subequipe (todas as equipes existentes).
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name }));
  // Nome da equipe atual de cada pessoa (para o seletor de alocação deixar claro
  // que alocar em outra equipe é uma TRANSFERÊNCIA — cada pessoa fica em uma só).
  const teamNameById = new Map(teams.map((t) => [t.id, t.name] as const));

  function renderNode(team: (typeof teams)[number], depth: number) {
    const kids = childrenOf.get(team.id) ?? [];
    const managers = team.leads.filter((l) => l.role === "MANAGER");
    const supervisors = team.leads.filter((l) => l.role === "SUPERVISOR");
    return (
      <div key={team.id} style={{ marginLeft: depth === 0 ? 0 : 18 }}>
        <div
          className="rounded-xl border border-slate-200"
          style={depth > 0 ? { borderLeftWidth: 3, borderLeftColor: "var(--brand,#2563eb)" } : undefined}
        >
          {/* Cabeçalho da equipe */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-ink">
                {depth === 0 ? "🏢" : "▸"} {team.name}
              </span>
              <span className="ml-2 text-xs text-slate-400">
                {team.members.length} pessoa(s)
                {kids.length > 0 && ` · ${kids.length} subequipe(s)`}
              </span>
              {managers.map((l) => (
                <span key={l.id} className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                  Gestor: {l.user.name}
                </span>
              ))}
              {supervisors.map((l) => (
                <span key={l.id} className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                  Supervisor: {l.user.name}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <form action={moveTeam.bind(null, team.id, "up")}>
                <button className="rounded border border-slate-200 px-1.5 text-xs" type="submit" title="Subir">↑</button>
              </form>
              <form action={moveTeam.bind(null, team.id, "down")}>
                <button className="rounded border border-slate-200 px-1.5 text-xs" type="submit" title="Descer">↓</button>
              </form>
              <form action={deleteTeam.bind(null, team.id)}>
                <button className="ml-1 text-xs text-red-500 hover:underline" type="submit">remover</button>
              </form>
            </div>
          </div>

          {/* Membros da equipe */}
          <ul className="divide-y divide-slate-50">
            {team.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-1.5 pl-5">
                <span className="min-w-0 truncate text-sm">
                  👤 {m.name} <span className="text-xs text-slate-400">{m.email}</span>
                </span>
                <form action={removeMember.bind(null, m.id)}>
                  <button className="shrink-0 text-xs text-slate-400 hover:text-red-500" type="submit">tirar</button>
                </form>
              </li>
            ))}
            {team.members.length === 0 && (
              <li className="px-3 py-1.5 pl-5 text-xs text-slate-400">Nenhuma pessoa nesta equipe.</li>
            )}
          </ul>

          {/* Gestão da equipe (liderança, alocação, subequipe, renomear) */}
          <details className="border-t border-slate-100 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500">
              Gerir equipe
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {/* Liderança */}
              <div>
                <p className="label text-xs">Liderança</p>
                {team.leads.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {team.leads.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 text-xs">
                        <span>
                          {l.role === "MANAGER" ? "Gestor" : "Supervisor"}: <b>{l.user.name}</b>
                        </span>
                        <form action={removeTeamLead.bind(null, l.id)}>
                          <button className="text-red-500 hover:underline" type="submit">remover</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={setTeamLead.bind(null, team.id)} className="flex flex-wrap items-center gap-1">
                  <select name="userId" required defaultValue="" className="input py-1.5 text-xs">
                    <option value="" disabled>Escolher pessoa…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select name="role" defaultValue="MANAGER" className="input py-1.5 text-xs">
                    <option value="MANAGER">Gestor</option>
                    <option value="SUPERVISOR">Supervisor</option>
                  </select>
                  <SubmitButton className="btn-outline px-2 py-1.5 text-xs" pendingText="…">definir</SubmitButton>
                </form>
                <p className="mt-1 text-[11px] text-slate-400">
                  Gestor enxerga a subárvore; supervisor, só esta equipe (usado nos dashboards).
                </p>
              </div>

              {/* Alocar pessoa */}
              <div>
                <p className="label text-xs">Alocar pessoa nesta equipe</p>
                <form action={assignMember.bind(null, team.id)} className="flex flex-wrap items-center gap-1">
                  <select name="userId" required defaultValue="" className="input py-1.5 text-xs">
                    <option value="" disabled>Escolher pessoa…</option>
                    {people.some((p) => !p.teamId) && (
                      <optgroup label="Sem equipe">
                        {people
                          .filter((p) => !p.teamId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </optgroup>
                    )}
                    {people.some((p) => p.teamId && p.teamId !== team.id) && (
                      <optgroup label="Transferir de outra equipe">
                        {people
                          .filter((p) => p.teamId && p.teamId !== team.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — hoje em {teamNameById.get(p.teamId!) ?? "outra equipe"}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                  <SubmitButton className="btn-outline px-2 py-1.5 text-xs" pendingText="…">alocar</SubmitButton>
                </form>
                <p className="mt-1 text-[11px] text-slate-400">
                  Cada pessoa fica em <b>uma</b> equipe: alocar alguém de outra equipe a <b>transfere</b> (não duplica).
                </p>

                {/* Renomear + subequipe */}
                <form action={renameTeam.bind(null, team.id)} className="mt-3 flex items-center gap-1">
                  <input name="name" defaultValue={team.name} className="input py-1.5 text-xs" />
                  <SubmitButton className="btn-outline px-2 py-1.5 text-xs" pendingText="…">renomear</SubmitButton>
                </form>
                <form action={createTeam} className="mt-1.5 flex items-center gap-1">
                  <input type="hidden" name="parentId" value={team.id} />
                  <input name="name" required className="input py-1.5 text-xs" placeholder="Nova subequipe" />
                  <SubmitButton className="btn-outline px-2 py-1.5 text-xs" pendingText="…">+ sub</SubmitButton>
                </form>
              </div>
            </div>
          </details>
        </div>

        {/* Subequipes (recursivo) */}
        {kids.length > 0 && (
          <div className="mt-2 space-y-2">{kids.map((k) => renderNode(k, depth + 1))}</div>
        )}
      </div>
    );
  }

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← Administração</Link>
          <h1 className="mt-1 text-2xl font-bold">Equipes &amp; organograma</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="card">
            <h2 className="mb-1 font-semibold">Organograma</h2>
            <p className="mb-4 text-xs text-slate-500">
              Monte a estrutura em árvore (ex.: Departamento ▸ Setor ▸ Turma). Cada
              equipe pode ter um gestor e/ou supervisor, e as pessoas são alocadas a
              uma equipe. Isto é a base — os painéis de RH e de gestor leem esta
              estrutura. A equipe é <strong>independente</strong> do perfil de acesso
              (que controla o conteúdo).
            </p>

            {roots.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">
                Nenhuma equipe ainda. Crie o primeiro departamento abaixo.
              </p>
            ) : (
              <div className="space-y-3">{roots.map((t) => renderNode(t, 0))}</div>
            )}

            {/* Nova equipe raiz / subequipe */}
            <form action={createTeam} className="mt-5 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto_auto]">
              <input name="name" required className="input" placeholder="Nome da equipe (ex.: Comercial)" />
              <select name="parentId" defaultValue="" className="input">
                <option value="">Sem mãe (departamento/raiz)</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>dentro de: {t.name}</option>
                ))}
              </select>
              <SubmitButton pendingText="Criando…">Criar equipe</SubmitButton>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <div className="card">
            <h2 className="mb-1 font-semibold">Resumo</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 py-3">
                <p className="text-2xl font-black text-ink">{teams.length}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Equipes</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-3">
                <p className="text-2xl font-black text-ink">{inTeams}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Alocados</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-3">
                <p className="text-2xl font-black text-ink">{totalPeople}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Pessoas</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="mb-1 font-semibold">Sem equipe</h2>
            <p className="mb-3 text-xs text-slate-500">
              {unassigned.length} pessoa(s) ainda não estão em nenhuma equipe. Aloque-as
              pelo botão “Gerir equipe → Alocar pessoa”.
            </p>
            {unassigned.length === 0 ? (
              <p className="text-sm text-emerald-600">Todo mundo está em uma equipe. ✓</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
                {unassigned.map((p) => (
                  <li key={p.id} className="truncate text-slate-600">
                    👤 {p.name}
                    {p.role !== "STUDENT" && (
                      <span className="ml-1 text-[11px] text-slate-400">({p.role})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

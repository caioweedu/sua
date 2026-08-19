import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { contentTenantIds } from "@/lib/access";
import { loadPlanningOverview } from "@/lib/planning";
import AppShell from "@/components/AppShell";
import GestorNav from "@/components/GestorNav";
import ImportPlanningCard from "./import-planning-card";

// Onda 3 · F3b — Painel de planejamento (RH): lista de colaboradores com o
// status do plano (atrasados/pendentes/em dia) e acesso ao planejamento de cada
// um. Import por planilha. Escopo por tenant.

function StatusBadge({ overdue, pending, total }: { overdue: number; pending: number; total: number }) {
  if (overdue > 0)
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">🔴 {overdue} atrasado(s)</span>;
  if (pending > 0)
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">⚠️ {pending} pendente(s)</span>;
  if (total > 0)
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">✓ em dia</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">sem plano</span>;
}

export default async function PlanejamentoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const rows = await loadPlanningOverview(user.tenantId, contentTenantIds(user.tenant));
  const comAtraso = rows.filter((r) => r.overdue > 0).length;
  const semPlano = rows.filter((r) => r.total === 0).length;

  return (
    <AppShell user={user} tenant={user.tenant}>
      <GestorNav active="planejamento" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← Administração</Link>
          <h1 className="mt-1 text-2xl font-bold">Planejamento de treinamentos</h1>
          <p className="text-sm text-slate-500">
            {rows.length} colaborador(es) · {comAtraso} com atraso · {semPlano} sem plano.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="card">
            <h2 className="mb-1 font-semibold">Colaboradores</h2>
            <p className="mb-4 text-xs text-slate-500">
              Clique para ver e editar o planejamento da pessoa. Ordenado por atraso.
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum colaborador ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/planejamento/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {r.email} · {r.total} planejado(s) · {r.done} concluído(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge overdue={r.overdue} pending={r.pending} total={r.total} />
                      <Link href={`/admin/planejamento/${r.id}`} className="btn-outline px-2 py-1 text-xs">
                        planejar
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <ImportPlanningCard />
        </section>
      </div>
    </AppShell>
  );
}

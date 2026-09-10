import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, canManageTeams } from "@/lib/auth";
import { contentTenantIds } from "@/lib/access";
import { loadComplianceOverview, WARN_DAYS } from "@/lib/compliance";
import GestorNav from "@/components/GestorNav";
import Icon from "@/components/Icon";

// Onda 3 · F3 — Painel de Compliance (admin): conformidade dos treinamentos
// OBRIGATÓRIOS por pessoa, considerando validade/recorrência. Só leitura.
// Escopo por tenant, com o conteúdo liberado pela mãe contabilizado.

function Tile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-black ${tone ?? "text-ink"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Chip({ n, tone, label }: { n: number; tone: string; label: string }) {
  if (n <= 0) return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{n} {label}</span>;
}

export default async function CompliancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageTeams(user.role)) redirect("/dashboard");

  const rows = await loadComplianceOverview(user.tenantId, contentTenantIds(user.tenant));

  const comObrigatorio = rows.filter((r) => r.total > 0);
  const conformes = comObrigatorio.filter((r) => r.conforme).length;
  const comVencido = rows.filter((r) => r.vencido > 0).length;
  const comPendente = rows.filter((r) => r.pendente > 0).length;
  const aVencer = rows.reduce((s, r) => s + r.aVencer, 0);
  const conformidadePct =
    comObrigatorio.length > 0 ? Math.round((conformes / comObrigatorio.length) * 100) : 100;

  return (
    <>
      <GestorNav active="compliance" />
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← Administração</Link>
        <h1 className="mt-1 text-2xl font-bold">Compliance de treinamentos</h1>
        <p className="text-sm text-slate-500">
          Conformidade dos treinamentos <strong>obrigatórios</strong>, com validade e
          recorrência (ex.: NRs anuais). Piores primeiro. Só leitura.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile
          label="Conformidade"
          value={`${conformidadePct}%`}
          sub={`${conformes}/${comObrigatorio.length} pessoas em conformidade`}
          tone={conformidadePct >= 90 ? "text-emerald-600" : conformidadePct >= 70 ? "text-amber-600" : "text-red-600"}
        />
        <Tile label="Com vencidos" value={comVencido} sub="pessoas com treino vencido" tone={comVencido > 0 ? "text-red-600" : "text-ink"} />
        <Tile label="Com pendências" value={comPendente} sub="obrigatórios não concluídos" tone={comPendente > 0 ? "text-amber-600" : "text-ink"} />
        <Tile label="A vencer" value={aVencer} sub={`vencem em até ${WARN_DAYS} dias`} tone={aVencer > 0 ? "text-amber-600" : "text-ink"} />
      </div>

      <div className="card mt-6">
        <h2 className="mb-1 font-semibold">Por colaborador</h2>
        <p className="mb-4 text-xs text-slate-500">
          Considera treinamentos obrigatórios atribuídos direto à pessoa e herdados da
          equipe. Clique para ver e ajustar o planejamento de cada um.
        </p>
        {comObrigatorio.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum treinamento obrigatório atribuído ainda. Marque treinamentos como
            obrigatórios (e defina a validade) no{" "}
            <Link href="/admin/planejamento" className="text-brand hover:underline">Planejamento</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {comObrigatorio.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link href={`/admin/planejamento/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {r.email} · {r.total} obrigatório(s)
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {r.conforme && r.vencido === 0 && r.pendente === 0 && r.aVencer === 0 && r.semData === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><Icon name="check" size={12} className="shrink-0" /> em conformidade</span>
                  ) : (
                    <>
                      <Chip n={r.vencido} tone="bg-red-50 text-red-600" label="vencido(s)" />
                      <Chip n={r.pendente} tone="bg-amber-50 text-amber-700" label="pendente(s)" />
                      <Chip n={r.aVencer} tone="bg-yellow-50 text-yellow-700" label="a vencer" />
                      <Chip n={r.semData} tone="bg-slate-100 text-slate-500" label="sem data" />
                      {r.emDia > 0 && <Chip n={r.emDia} tone="bg-emerald-50 text-emerald-700" label="em dia" />}
                    </>
                  )}
                  <Link href={`/admin/planejamento/${r.id}`} className="btn-outline px-2 py-1 text-xs">
                    planejar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

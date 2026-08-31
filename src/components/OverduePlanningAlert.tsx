import Link from "next/link";

// Card de alerta de atrasos no planejamento (treinamentos com prazo vencido).
// Reutilizado no Painel Gestor do admin (/admin/rh) e no painel escopado
// (/minha-equipe). `hrefBase` define para onde vai o link de cada pessoa:
// admin → /admin/planejamento; gestor/supervisor/RH → /minha-equipe.

export type OverdueRow = {
  id: string;
  name: string;
  email: string;
  total: number;
  done: number;
  overdue: number;
};

export default function OverduePlanningAlert({
  rows,
  hrefBase,
}: {
  rows: OverdueRow[];
  hrefBase: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card mt-6">
        <p className="text-sm text-emerald-700">
          ✓ Ninguém com treinamento planejado atrasado.
        </p>
      </div>
    );
  }

  return (
    <div className="card mt-6 border-red-200">
      <h2 className="mb-1 font-semibold text-red-700">🔴 Atrasos no planejamento</h2>
      <p className="mb-3 text-xs text-slate-500">
        {rows.length} pessoa(s) com treinamento planejado vencido. Clique para ver o planejamento.
      </p>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <Link href={`${hrefBase}/${r.id}`} className="font-medium hover:underline">
                {r.name}
              </Link>
              <p className="truncate text-xs text-slate-500">
                {r.email} · {r.done}/{r.total} concluído(s)
              </p>
            </div>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
              {r.overdue} atrasado(s)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

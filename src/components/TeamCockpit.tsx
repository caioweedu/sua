import Link from "next/link";
import {
  type TeamCockpitData,
  type TeamNode,
  aggMembers,
  subtreeMemberIds,
} from "@/lib/teamCockpit";

// Renderiza a árvore de equipes com métricas (rollup) e drill-down ao individual.
//  - mode "tree": cada equipe soma ela + subequipes e recorre (RH/gestor/admin).
//  - mode "direct": mostra só a própria equipe e seus membros diretos (supervisor).
export default function TeamCockpit({
  data,
  roots,
  mode,
  // Base do link "ficha →" de cada pessoa. Admin usa a ficha editável
  // (/admin/alunos); gestor/supervisor/RH usam a ficha só leitura (/minha-equipe).
  fichaBase = "/admin/alunos",
}: {
  data: TeamCockpitData;
  roots: TeamNode[];
  mode: "tree" | "direct";
  fichaBase?: string;
}) {
  const { byId, directMembers, childrenOf } = data;

  function MemberTable({ ids }: { ids: string[] }) {
    const rows = ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (rows.length === 0) return null;
    return (
      <details className="px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500">
          Pessoas nesta equipe ({rows.length})
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-1 pr-4">Pessoa</th>
                <th className="pb-1 pr-4">Matríc.</th>
                <th className="pb-1 pr-4">Concl.</th>
                <th className="pb-1 pr-4">Aulas</th>
                <th className="pb-1 pr-4">Aprov.</th>
                <th className="pb-1 pr-4">Cert.</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-4 font-medium text-ink">{r.name}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{r.enrolled}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{r.completed}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{r.aulasDone}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{r.examsPassed}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{r.certificates}</td>
                  <td className="py-1.5">
                    <Link href={`${fichaBase}/${r.id}`} className="text-xs text-brand hover:underline">
                      ficha →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    );
  }

  function renderNode(team: TeamNode, depth: number) {
    const kids = mode === "tree" ? childrenOf.get(team.id) ?? [] : [];
    const memberIds =
      mode === "tree" ? subtreeMemberIds(team.id, data) : directMembers.get(team.id) ?? [];
    const m = aggMembers(memberIds, byId);
    const direct = directMembers.get(team.id) ?? [];
    return (
      <div key={team.id} style={{ marginLeft: depth === 0 ? 0 : 18 }}>
        <div
          className="rounded-xl border border-slate-200"
          style={depth > 0 ? { borderLeftWidth: 3, borderLeftColor: "var(--brand,#2563eb)" } : undefined}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-sm font-semibold text-ink">
              {depth === 0 ? "🏢" : "▸"} {team.name}
              {mode === "tree" && kids.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">(inclui subequipes)</span>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span><b className="text-ink">{m.pessoas}</b> pessoa(s)</span>
              <span>Adesão <b className="text-ink">{m.adesao}%</b></span>
              <span>Conclusão <b className="text-ink">{m.conclusao}%</b></span>
              <span><b className="text-ink">{m.certs}</b> cert.</span>
            </div>
          </div>
          <MemberTable ids={direct} />
        </div>
        {kids.length > 0 && (
          <div className="mt-2 space-y-2">{kids.map((k) => renderNode(k, depth + 1))}</div>
        )}
      </div>
    );
  }

  if (roots.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma equipe no seu escopo ainda.</p>;
  }
  return <div className="space-y-3">{roots.map((t) => renderNode(t, 0))}</div>;
}

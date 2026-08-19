import SubmitButton from "@/components/SubmitButton";
import { assignTraining, removeAssignment } from "@/lib/actions/agenda";
import type { AgendaItem } from "@/lib/agenda";

// Editor de agenda de treinamentos (F3): lista o que já está planejado e permite
// atribuir novos (por vitrine, todos ou alguns) com início/fim previstos.
// Server component reutilizado pela página de planejamento por colaborador.

type VitrineOpt = { id: string; name: string; trilhas: { id: string; title: string }[] };

function fmtD(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : null;
}
function fmtPeriodo(s: Date | null, e: Date | null) {
  const si = fmtD(s);
  const ei = fmtD(e);
  if (si && ei) return `${si} → ${ei}`;
  if (ei) return `até ${ei}`;
  if (si) return `a partir de ${si}`;
  return "sem prazo";
}

export default function AgendaEditor({
  student,
  agenda,
  vitrines,
  orphans,
}: {
  student: { id: string; name: string };
  agenda: AgendaItem[];
  vitrines: VitrineOpt[];
  orphans: { id: string; title: string }[];
}) {
  const vitrinesComProduto = vitrines.filter((v) => v.trilhas.length > 0);
  const temProdutos = vitrinesComProduto.length > 0 || orphans.length > 0;

  return (
    <div>
      {agenda.length > 0 ? (
        <ul className="mb-4 divide-y divide-slate-100">
          {agenda.map((a) => (
            <li key={a.trilhaId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <span className="font-medium text-ink">{a.title}</span>
                {a.required && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">obrigatório</span>
                )}
                {a.source === "team" && (
                  <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600">equipe</span>
                )}
                <p className="text-xs text-slate-500">
                  Período: <span className={a.overdue ? "font-semibold text-red-600" : ""}>{fmtPeriodo(a.startDate, a.dueDate)}</span>
                  {a.overdue ? " · atrasado" : ""} · progresso {a.progressPct}%
                  {a.completed ? " · concluído ✓" : ""}
                </p>
              </div>
              {a.source === "you" ? (
                <form action={removeAssignment.bind(null, a.assignmentId)}>
                  <button className="text-xs text-red-500 hover:underline" type="submit">remover</button>
                </form>
              ) : (
                <span className="text-[11px] text-slate-400">gerido na equipe</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-slate-500">Nenhum treinamento planejado para {student.name} ainda.</p>
      )}

      {!temProdutos ? (
        <p className="text-sm text-slate-500">Nenhum treinamento publicado para atribuir.</p>
      ) : (
        <form action={assignTraining} className="space-y-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="userId" value={student.id} />
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {vitrinesComProduto.map((v) => (
              <div key={v.id}>
                <p className="mb-1 text-xs font-semibold text-slate-500">🗂️ {v.name}</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {v.trilhas.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="trilhaIds" value={t.id} className="h-4 w-4 rounded border-slate-300" />
                      {t.title}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {orphans.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">Sem vitrine</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {orphans.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="trilhaIds" value={t.id} className="h-4 w-4 rounded border-slate-300" />
                      {t.title}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label text-xs">Início previsto (opcional)</label>
              <input name="startDate" type="date" className="input py-1.5 text-sm" />
            </div>
            <div>
              <label className="label text-xs">Fim previsto / prazo (opcional)</label>
              <input name="dueDate" type="date" className="input py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" name="required" defaultChecked /> obrigatório
            </label>
            <SubmitButton className="btn-brand text-sm" pendingText="Atribuindo…">Atribuir selecionados</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

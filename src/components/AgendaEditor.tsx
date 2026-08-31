import SubmitButton from "@/components/SubmitButton";
import TrilhaPicker from "@/components/TrilhaPicker";
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
function fmtRecorrencia(m: number | null) {
  if (!m || m <= 0) return null;
  if (m === 12) return "renova todo ano";
  if (m % 12 === 0) return `renova a cada ${m / 12} anos`;
  return `renova a cada ${m} ${m === 1 ? "mês" : "meses"}`;
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
                {fmtRecorrencia(a.recurrenceMonths) && (
                  <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">🔁 {fmtRecorrencia(a.recurrenceMonths)}</span>
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
          <TrilhaPicker vitrines={vitrinesComProduto} orphans={orphans} />
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
          <div>
            <label className="label text-xs">Validade / recorrência (opcional)</label>
            <div className="flex items-center gap-2">
              <input
                name="recurrenceMonths"
                type="number"
                min={1}
                step={1}
                placeholder="ex.: 12"
                className="input w-28 py-1.5 text-sm"
              />
              <span className="text-xs text-slate-500">meses — refaz o treinamento ao vencer (ex.: 12 = NR anual). Vazio = uma vez só.</span>
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

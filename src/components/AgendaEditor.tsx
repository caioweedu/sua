import SubmitButton from "@/components/SubmitButton";
import TrilhaPicker from "@/components/TrilhaPicker";
import Icon from "@/components/Icon";
import {
  assignTraining,
  removeAssignment,
  createExternalTraining,
  markExternalDone,
  unmarkExternalDone,
  markExternalDoneForTeam,
} from "@/lib/actions/agenda";
import type { AgendaItem } from "@/lib/agenda";

// Editor de agenda de treinamentos (F3): lista o que já está planejado e permite
// atribuir novos — ONLINE (trilhas da plataforma, por vitrine) e EXTERNAL
// (presencial/outra plataforma, com baixa manual do RH). Server component
// reutilizado pela página de planejamento por colaborador.

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
  student: { id: string; name: string; teamId?: string | null; teamName?: string | null };
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
          {agenda.map((a) => {
            const rec = fmtRecorrencia(a.recurrenceMonths);
            const isExternal = a.kind === "external";
            return (
              <li key={a.assignmentId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <span className="font-medium text-ink">{a.title}</span>
                  {a.required && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">obrigatório</span>
                  )}
                  {isExternal && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"><Icon name="graduationCap" size={11} className="shrink-0" /> externo</span>
                  )}
                  {a.source === "team" && (
                    <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600">equipe</span>
                  )}
                  {rec && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"><Icon name="repeat" size={11} className="shrink-0" /> {rec}</span>
                  )}
                  <p className="text-xs text-slate-500">
                    {isExternal && a.location ? <>{a.location} · </> : null}
                    Período: <span className={a.overdue || a.expired ? "font-semibold text-red-600" : ""}>{fmtPeriodo(a.startDate, a.dueDate)}</span>
                    {a.overdue ? " · atrasado" : ""}
                    {!isExternal ? ` · progresso ${a.progressPct}%` : ""}
                    {a.completed && !a.expired ? " · concluído ✓" : ""}
                    {a.expired ? " · vencido — refazer" : ""}
                    {a.completed && a.expiresAt ? ` · válido até ${fmtD(a.expiresAt)}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                  {isExternal ? (
                    <>
                      {!a.completed || a.expired ? (
                        <form action={markExternalDone.bind(null, a.assignmentId, student.id)} className="flex items-center gap-1.5">
                          <input name="completedAt" type="date" className="input px-1.5 py-0.5 text-[11px]" title="Data da conclusão (opcional)" />
                          <button className="btn-brand px-2 py-1 text-xs" type="submit">dar baixa</button>
                        </form>
                      ) : (
                        <form action={unmarkExternalDone.bind(null, a.assignmentId, student.id)}>
                          <button className="text-xs text-slate-500 hover:underline" type="submit">desfazer baixa</button>
                        </form>
                      )}
                      {a.source === "team" && (
                        <form action={markExternalDoneForTeam.bind(null, a.assignmentId)}>
                          <button className="text-xs text-slate-500 hover:underline" type="submit" title="Concluir para todos os membros da equipe">baixa em todos</button>
                        </form>
                      )}
                      {a.source === "you" && (
                        <form action={removeAssignment.bind(null, a.assignmentId)}>
                          <button className="text-xs text-red-500 hover:underline" type="submit">remover</button>
                        </form>
                      )}
                    </>
                  ) : a.source === "you" ? (
                    <form action={removeAssignment.bind(null, a.assignmentId)}>
                      <button className="text-xs text-red-500 hover:underline" type="submit">remover</button>
                    </form>
                  ) : (
                    <span className="text-[11px] text-slate-400">gerido na equipe</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-slate-500">Nenhum treinamento planejado para {student.name} ainda.</p>
      )}

      {/* Atribuir treinamento ONLINE (trilhas da plataforma) */}
      {!temProdutos ? (
        <p className="text-sm text-slate-500">Nenhum treinamento publicado para atribuir.</p>
      ) : (
        <form action={assignTraining} className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Treinamento na plataforma</p>
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
              <input name="recurrenceMonths" type="number" min={1} step={1} placeholder="ex.: 12" className="input w-28 py-1.5 text-sm" />
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

      {/* Planejar treinamento EXTERNO / presencial (baixa manual) */}
      <form action={createExternalTraining} className="mt-6 space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700"><Icon name="graduationCap" size={14} className="shrink-0" /> Treinamento externo / presencial</p>
        <p className="text-xs text-slate-500">Fora da plataforma (presencial, curso externo, workshop). Depois de acontecer, você dá baixa aqui.</p>
        <input type="hidden" name="userId" value={student.id} />
        {student.teamId && <input type="hidden" name="teamId" value={student.teamId} />}
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label text-xs">Título do treinamento</label>
            <input name="title" required className="input py-1.5 text-sm" placeholder="Ex.: NR-35 Trabalho em Altura" />
          </div>
          <div>
            <label className="label text-xs">Local / modalidade (opcional)</label>
            <input name="location" className="input py-1.5 text-sm" placeholder="Ex.: Presencial — sala 2 / Curso na Alura" />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className="label text-xs">Início (opcional)</label>
            <input name="startDate" type="date" className="input py-1.5 text-sm" />
          </div>
          <div>
            <label className="label text-xs">Prazo (opcional)</label>
            <input name="dueDate" type="date" className="input py-1.5 text-sm" />
          </div>
          <div>
            <label className="label text-xs">Validade (meses)</label>
            <input name="recurrenceMonths" type="number" min={1} step={1} placeholder="ex.: 12" className="input py-1.5 text-sm" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" name="required" defaultChecked /> obrigatório
            </label>
            {student.teamId && (
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" name="toTeam" /> atribuir à equipe{student.teamName ? ` (${student.teamName})` : ""}
              </label>
            )}
          </div>
          <SubmitButton className="btn-brand text-sm" pendingText="Salvando…">Adicionar externo</SubmitButton>
        </div>
      </form>
    </div>
  );
}

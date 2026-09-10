import Icon from "@/components/Icon";
import type { AgendaItem } from "@/lib/agenda";

// Onda 3 · F3c — agenda de treinamentos planejados de uma pessoa, SÓ LEITURA.
// Usada na ficha do gestor/supervisor (/minha-equipe/[id]) para reconciliar a
// contagem de "atrasados" do painel com o que a pessoa realmente tem planejado.
// A edição segue no admin/RH (/admin/planejamento/[id]).

function fmtD(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : null;
}

function period(a: AgendaItem): string {
  const s = fmtD(a.startDate);
  const e = fmtD(a.dueDate);
  if (s && e) return `${s} → ${e}`;
  if (e) return `Prazo: ${e}`;
  if (s) return `A partir de ${s}`;
  return "Sem prazo";
}

type Badge = { label: string; cls: string };

function statusBadge(a: AgendaItem): Badge {
  if (a.expired) return { label: "vencido — refazer", cls: "bg-red-50 text-red-600" };
  if (!a.completed && a.overdue) return { label: "atrasado", cls: "bg-red-50 text-red-600" };
  if (a.completed && a.expiringSoon) return { label: "vence em breve", cls: "bg-amber-50 text-amber-700" };
  if (a.completed) return { label: "concluído", cls: "bg-emerald-50 text-emerald-700" };
  if (a.kind === "external") return { label: "aguardando baixa", cls: "bg-slate-100 text-slate-500" };
  return { label: "no prazo", cls: "bg-slate-100 text-slate-500" };
}

export default function AgendaReadonly({ agenda }: { agenda: AgendaItem[] }) {
  if (agenda.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum treinamento planejado para esta pessoa.</p>;
  }

  const atrasados = agenda.filter((a) => (a.overdue && !a.completed) || a.expired).length;

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        Treinamentos planejados (online + externos), diretos e herdados da equipe.
        {atrasados > 0 ? (
          <span className="font-semibold text-red-600"> {atrasados} atrasado(s)/vencido(s).</span>
        ) : (
          " Nenhum atraso."
        )}{" "}
        Para editar, use o Planejamento no painel de RH.
      </p>
      <ul className="divide-y divide-slate-100">
        {agenda.map((a) => {
          const b = statusBadge(a);
          const danger = (a.overdue && !a.completed) || a.expired;
          return (
            <li key={a.assignmentId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-ink">{a.title}</span>
                  {a.required && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">obrigatório</span>
                  )}
                  {a.kind === "external" && (
                    <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                      <Icon name="graduationCap" size={11} className="shrink-0" /> {a.location || "externo"}
                    </span>
                  )}
                  {a.source === "team" && (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600">equipe</span>
                  )}
                  {a.recurrenceMonths && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      <Icon name="repeat" size={11} className="shrink-0" /> renova
                    </span>
                  )}
                </span>
                <p className={`text-xs ${danger ? "font-semibold text-red-600" : "text-slate-500"}`}>
                  {a.expired ? `Vencido em ${fmtD(a.expiresAt)}` : period(a)}
                  {a.kind === "online" && !a.completed ? ` · progresso ${a.progressPct}%` : ""}
                  {a.completed && a.expiresAt ? ` · válido até ${fmtD(a.expiresAt)}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { PlanningRow } from "@/lib/planning";

// Onda 3 · F3c — lista de colaboradores do Planejamento com filtro de status
// e busca por nome/e-mail (instantâneos, no cliente). Recebe as linhas já
// escopadas pela equipe (server) e filtra em memória.

function StatusBadge({ overdue, pending, total }: { overdue: number; pending: number; total: number }) {
  if (overdue > 0)
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"><Icon name="alertTriangle" size={12} className="shrink-0" /> {overdue} atrasado(s)</span>;
  if (pending > 0)
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><Icon name="alertCircle" size={12} className="shrink-0" /> {pending} pendente(s)</span>;
  if (total > 0)
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><Icon name="check" size={12} className="shrink-0" /> em dia</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">sem plano</span>;
}

type StatusKey = "all" | "atrasados" | "pendentes" | "semplano" | "emdia";
const STATUS: { v: StatusKey; label: string }[] = [
  { v: "all", label: "Todos os status" },
  { v: "atrasados", label: "Atrasados" },
  { v: "pendentes", label: "Pendentes (no prazo)" },
  { v: "semplano", label: "Sem plano" },
  { v: "emdia", label: "Em dia" },
];

function matchStatus(r: PlanningRow, s: StatusKey): boolean {
  switch (s) {
    case "atrasados": return r.overdue > 0;
    case "pendentes": return r.pending > 0 && r.overdue === 0;
    case "semplano": return r.total === 0;
    case "emdia": return r.total > 0 && r.pending === 0;
    default: return true;
  }
}

export default function PlanningCollabList({ rows }: { rows: PlanningRow[] }) {
  const [status, setStatus] = useState<StatusKey>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchStatus(r, status)) return false;
      if (term && !`${r.name} ${r.email}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, status, q]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" size={15} />
          </span>
          <input
            id="planning-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="input w-full pl-8 text-sm"
          />
        </div>
        <select
          id="planning-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusKey)}
          className="input text-sm sm:w-56"
        >
          {STATUS.map((s) => (
            <option key={s.v} value={s.v}>{s.label}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum colaborador ainda.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum colaborador com esse filtro.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((r) => (
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
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { ComplianceRow } from "@/lib/compliance";

// Onda 3 · F3c — lista de colaboradores do Compliance com filtro de status e
// busca por nome/e-mail (instantâneos, no cliente). Recebe as linhas já
// escopadas pela equipe (só quem tem obrigatórios) e filtra em memória.

function Chip({ n, tone, label }: { n: number; tone: string; label: string }) {
  if (n <= 0) return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{n} {label}</span>;
}

function conformeTotal(r: ComplianceRow): boolean {
  return r.conforme && r.vencido === 0 && r.pendente === 0 && r.aVencer === 0 && r.semData === 0;
}

type StatusKey = "all" | "vencidos" | "pendentes" | "avencer" | "semdata" | "conformidade";
const STATUS: { v: StatusKey; label: string }[] = [
  { v: "all", label: "Todos os status" },
  { v: "vencidos", label: "Com vencidos" },
  { v: "pendentes", label: "Com pendências" },
  { v: "avencer", label: "A vencer" },
  { v: "semdata", label: "Sem data" },
  { v: "conformidade", label: "Em conformidade" },
];

function matchStatus(r: ComplianceRow, s: StatusKey): boolean {
  switch (s) {
    case "vencidos": return r.vencido > 0;
    case "pendentes": return r.pendente > 0;
    case "avencer": return r.aVencer > 0;
    case "semdata": return r.semData > 0;
    case "conformidade": return conformeTotal(r);
    default: return true;
  }
}

export default function ComplianceCollabList({ rows }: { rows: ComplianceRow[] }) {
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
            id="compliance-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="input w-full pl-8 text-sm"
          />
        </div>
        <select
          id="compliance-status"
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
        <p className="text-sm text-slate-500">
          Nenhum treinamento obrigatório atribuído ainda.
        </p>
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
                  {r.email} · {r.total} obrigatório(s)
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {conformeTotal(r) ? (
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
  );
}

"use client";

import { useEffect, useState } from "react";
import SubmitButton from "./SubmitButton";

export type CondOption = { id: string; label: string };

// Uma cláusula no estado do editor (campos como string para os inputs).
type Clause = {
  type: string;
  targetAulaId?: string;
  targetExamPlacementId?: string;
  targetModuloId?: string;
  targetTrilhaId?: string;
  minScore?: string;
  percent?: string;
  days?: string;
};

export type RuleData = {
  logic: string;
  clauses: {
    type: string;
    targetAulaId: string | null;
    targetExamPlacementId: string | null;
    targetModuloId: string | null;
    targetTrilhaId: string | null;
    minScore: number | null;
    percent: number | null;
    days: number | null;
  }[];
} | null;

const TYPE_LABELS: Record<string, string> = {
  AFTER_AULA: "Concluir uma aula",
  AFTER_ALL_LESSONS: "Concluir todas as aulas",
  AFTER_EXAM_PASSED: "Ser aprovado numa prova",
  AFTER_MODULE_COMPLETED: "Concluir um módulo",
  AFTER_TRILHA_COMPLETED: "Concluir um produto",
  AFTER_PERCENT: "Concluir % do produto",
  AFTER_DAYS: "Após X dias da matrícula",
};
const TYPE_ORDER = Object.keys(TYPE_LABELS);

// Editor de REGRA de liberação: uma lista de requisitos (cláusulas) combinados
// por TODAS (E) ou QUALQUER (OU). Recebe a server action já vinculada e as
// listas de alvos candidatos. Serializa a regra em JSON num campo oculto.
export default function ConditionEditor({
  action,
  current,
  exams,
  modulos,
  trilhas,
  aulas = [],
  compact = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  current: RuleData;
  exams: CondOption[];
  modulos: CondOption[];
  trilhas: CondOption[];
  aulas?: CondOption[];
  compact?: boolean;
}) {
  // Converte a regra salva (vinda do servidor) para o estado do editor.
  const fromCurrent = (): Clause[] =>
    (current?.clauses ?? []).map((c) => ({
      type: c.type,
      targetAulaId: c.targetAulaId ?? undefined,
      targetExamPlacementId: c.targetExamPlacementId ?? undefined,
      targetModuloId: c.targetModuloId ?? undefined,
      targetTrilhaId: c.targetTrilhaId ?? undefined,
      minScore: c.minScore != null ? String(c.minScore) : undefined,
      percent: c.percent != null ? String(c.percent) : undefined,
      days: c.days != null ? String(c.days) : undefined,
    }));

  const [logic, setLogic] = useState(current?.logic === "ANY" ? "ANY" : "ALL");
  const [clauses, setClauses] = useState<Clause[]>(fromCurrent);

  // Re-hidrata o editor quando a regra REGISTRADA muda (ex.: logo após salvar,
  // o servidor revalida e envia o `current` atualizado). Sem isto, o estado do
  // cliente ficava "preso" no valor inicial e podia divergir do que foi gravado.
  // Compara por assinatura serializada para não resetar durante a edição.
  const signature = JSON.stringify(current);
  useEffect(() => {
    setLogic(current?.logic === "ANY" ? "ANY" : "ALL");
    setClauses(fromCurrent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const inputCls = compact ? "input py-1.5 text-xs" : "input";

  function update(i: number, patch: Partial<Clause>) {
    setClauses((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add() {
    setClauses((cs) => [...cs, { type: "AFTER_ALL_LESSONS" }]);
  }
  function remove(i: number) {
    setClauses((cs) => cs.filter((_, idx) => idx !== i));
  }

  // Serializa a regra para o campo oculto (o server action lê "rule").
  const ruleJson = JSON.stringify({
    logic,
    clauses: clauses.map((c) => ({
      type: c.type,
      targetAulaId: c.targetAulaId ?? null,
      targetExamPlacementId: c.targetExamPlacementId ?? null,
      targetModuloId: c.targetModuloId ?? null,
      targetTrilhaId: c.targetTrilhaId ?? null,
      minScore: c.minScore ? Number(c.minScore) : null,
      percent: c.percent ? Number(c.percent) : null,
      days: c.days ? Number(c.days) : null,
    })),
  });

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="rule" value={ruleJson} />

      {clauses.length === 0 && (
        <p className="text-xs text-slate-400">Sempre liberado (nenhum requisito).</p>
      )}

      {clauses.length > 1 && (
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-500">Precisa cumprir:</span>
          <label className="flex items-center gap-1">
            <input type="radio" checked={logic === "ALL"} onChange={() => setLogic("ALL")} />
            TODAS
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={logic === "ANY"} onChange={() => setLogic("ANY")} />
            QUALQUER
          </label>
        </div>
      )}

      <div className="space-y-2">
        {clauses.map((c, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-center gap-1.5">
              <select
                value={c.type}
                onChange={(e) => update(i, { type: e.target.value })}
                className={`${inputCls} flex-1`}
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 px-1.5 text-xs text-red-500 hover:underline"
                title="Remover requisito"
              >
                ✕
              </button>
            </div>

            {c.type === "AFTER_AULA" && (
              <select value={c.targetAulaId ?? ""} onChange={(e) => update(i, { targetAulaId: e.target.value })} className={`${inputCls} mt-1.5`}>
                <option value="" disabled>Selecione a aula…</option>
                {aulas.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            )}
            {c.type === "AFTER_EXAM_PASSED" && (
              <div className="mt-1.5 space-y-1.5">
                <select value={c.targetExamPlacementId ?? ""} onChange={(e) => update(i, { targetExamPlacementId: e.target.value })} className={inputCls}>
                  <option value="" disabled>Selecione a prova…</option>
                  {exams.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <input type="number" min={0} max={100} value={c.minScore ?? ""} onChange={(e) => update(i, { minScore: e.target.value })} className={inputCls} placeholder="Nota mínima (%) — opcional" />
              </div>
            )}
            {c.type === "AFTER_MODULE_COMPLETED" && (
              <select value={c.targetModuloId ?? ""} onChange={(e) => update(i, { targetModuloId: e.target.value })} className={`${inputCls} mt-1.5`}>
                <option value="" disabled>Selecione o módulo…</option>
                {modulos.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            )}
            {c.type === "AFTER_TRILHA_COMPLETED" && (
              <select value={c.targetTrilhaId ?? ""} onChange={(e) => update(i, { targetTrilhaId: e.target.value })} className={`${inputCls} mt-1.5`}>
                <option value="" disabled>Selecione o produto…</option>
                {trilhas.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            )}
            {c.type === "AFTER_PERCENT" && (
              <input type="number" min={0} max={100} value={c.percent ?? ""} onChange={(e) => update(i, { percent: e.target.value })} className={`${inputCls} mt-1.5`} placeholder="% do produto" />
            )}
            {c.type === "AFTER_DAYS" && (
              <input type="number" min={0} value={c.days ?? ""} onChange={(e) => update(i, { days: e.target.value })} className={`${inputCls} mt-1.5`} placeholder="Dias após a matrícula" />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={add} className="btn-outline px-2 py-1.5 text-xs">
          + Requisito
        </button>
        <SubmitButton className={compact ? "btn-brand px-2 py-1.5 text-xs" : "btn-brand"} pendingText="Salvando…">
          Salvar liberação
        </SubmitButton>
      </div>
    </form>
  );
}

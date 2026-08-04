"use client";

import { useState } from "react";
import SubmitButton from "./SubmitButton";

export type CondOption = { id: string; label: string };
export type CondData = {
  type: string;
  targetExamPlacementId: string | null;
  targetModuloId: string | null;
  targetTrilhaId: string | null;
  minScore: number | null;
  percent: number | null;
  days: number | null;
} | null;

const TYPE_LABELS: Record<string, string> = {
  "": "Sempre liberado",
  AFTER_ALL_LESSONS: "Após concluir todas as aulas",
  AFTER_EXAM_PASSED: "Após ser aprovado em uma prova",
  AFTER_MODULE_COMPLETED: "Após concluir um módulo",
  AFTER_TRILHA_COMPLETED: "Após concluir um produto",
  AFTER_PERCENT: "Após concluir % do produto",
  AFTER_DAYS: "Após X dias da matrícula",
};

// Editor reutilizável de condição de liberação. Recebe a server action já
// vinculada (kind/id/redirectTo) e as listas de alvos candidatos.
export default function ConditionEditor({
  action,
  current,
  exams,
  modulos,
  trilhas,
  compact = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  current: CondData;
  exams: CondOption[];
  modulos: CondOption[];
  trilhas: CondOption[];
  compact?: boolean;
}) {
  const [type, setType] = useState(current?.type ?? "");
  const inputCls = compact ? "input py-1.5 text-xs" : "input";

  return (
    <form action={action} className="space-y-2">
      <select
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className={inputCls}
      >
        {Object.entries(TYPE_LABELS).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>

      {type === "AFTER_EXAM_PASSED" && (
        <div className="space-y-2">
          <select name="targetExamPlacementId" defaultValue={current?.targetExamPlacementId ?? ""} className={inputCls} required>
            <option value="" disabled>Selecione a prova…</option>
            {exams.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <input
            name="minScore"
            type="number"
            min={0}
            max={100}
            defaultValue={current?.minScore ?? ""}
            className={inputCls}
            placeholder="Nota mínima (%) — opcional"
          />
        </div>
      )}

      {type === "AFTER_MODULE_COMPLETED" && (
        <select name="targetModuloId" defaultValue={current?.targetModuloId ?? ""} className={inputCls} required>
          <option value="" disabled>Selecione o módulo…</option>
          {modulos.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}

      {type === "AFTER_TRILHA_COMPLETED" && (
        <select name="targetTrilhaId" defaultValue={current?.targetTrilhaId ?? ""} className={inputCls} required>
          <option value="" disabled>Selecione o produto…</option>
          {trilhas.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}

      {type === "AFTER_PERCENT" && (
        <input
          name="percent"
          type="number"
          min={0}
          max={100}
          defaultValue={current?.percent ?? 50}
          className={inputCls}
          placeholder="% do produto"
          required
        />
      )}

      {type === "AFTER_DAYS" && (
        <input
          name="days"
          type="number"
          min={0}
          defaultValue={current?.days ?? 7}
          className={inputCls}
          placeholder="Dias após a matrícula"
          required
        />
      )}

      <SubmitButton
        className={compact ? "btn-outline px-2 py-1.5 text-xs" : "btn-brand"}
        pendingText="Salvando…"
      >
        Salvar condição
      </SubmitButton>
    </form>
  );
}

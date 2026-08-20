"use client";

import { useActionState } from "react";
import { importPlanning, type ImportPlanningResult } from "@/lib/actions/agenda";

const initial: ImportPlanningResult = { ok: false };

export default function ImportPlanningCard() {
  const [state, action, pending] = useActionState(importPlanning, initial);

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Importar planejamento por planilha</h2>
      <p className="mb-4 text-xs text-slate-500">
        Baixe o modelo, preencha e suba para planejar treinamentos em massa. Cada
        linha atribui um treinamento a um colaborador (por e-mail) ou a uma equipe
        (pelo nome), com início/fim previstos. Salve como CSV.
      </p>
      <form action={action} className="space-y-4">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Planejamento</span>
            <a
              href="/api/admin/import/template?type=planejamento"
              className="text-xs font-medium text-brand hover:underline"
            >
              ↓ Baixar modelo
            </a>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Colunas: E-mail · Equipe · Treinamento · Início · Fim · Obrigatório.
            Preencha e-mail <em>ou</em> equipe (não os dois).
          </p>
          <input
            type="file"
            name="planejamento"
            accept=".csv,text/csv"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
        </div>
        <button className="btn-brand" type="submit" disabled={pending}>
          {pending ? "Importando..." : "Importar planejamento"}
        </button>
      </form>

      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && state.stats && (
        <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          <p className="font-semibold">✓ {state.message}</p>
          <p className="mt-1 text-xs">
            {state.stats.criados} criado(s) · {state.stats.atualizados} atualizado(s).
          </p>
          {state.avisos && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-amber-700">
              {state.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { importContent, type ImportResult } from "@/lib/actions/import";

const initial: ImportResult = { ok: false };

export default function ImportCard() {
  const [state, action, pending] = useActionState(importContent, initial);

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Importar por planilha</h2>
      <p className="mb-4 text-xs text-slate-500">
        Baixe o modelo, preencha e suba para criar vitrines, produtos, módulos,
        aulas e provas de uma vez. O modelo abre no Excel e no Google Sheets já
        com cada campo em sua coluna. Para reenviar, salve como CSV (no Sheets:
        Arquivo → Baixar → CSV).
      </p>

      <form action={action} className="space-y-4">
        {/* Conteúdo */}
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Conteúdo</span>
            <a
              href="/api/admin/import/template?type=conteudo"
              className="text-xs font-medium text-brand hover:underline"
            >
              ↓ Baixar modelo
            </a>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Colunas: Vitrine · Produto · Descrição · Módulo · Aula · Vídeo · PDF ·
            Descrição da aula
          </p>
          <input
            type="file"
            name="conteudo"
            accept=".csv,text/csv"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
        </div>

        {/* Provas */}
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Provas</span>
            <a
              href="/api/admin/import/template?type=provas"
              className="text-xs font-medium text-brand hover:underline"
            >
              ↓ Baixar modelo
            </a>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Colunas: Produto · Enunciado · Alternativa Correta · Alternativa 2…
            (a 1ª alternativa é a correta)
          </p>
          <input
            type="file"
            name="provas"
            accept=".csv,text/csv"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
        </div>

        <button className="btn-brand" type="submit" disabled={pending}>
          {pending ? "Importando..." : "Importar planilha"}
        </button>
      </form>

      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.ok && state.stats && (
        <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          <p className="font-semibold">✓ {state.message}</p>
          <p className="mt-1 text-xs">
            {state.stats.vitrines} vitrine(s) · {state.stats.produtos} produto(s) ·{" "}
            {state.stats.modulos} módulo(s) · {state.stats.aulas} aula(s) ·{" "}
            {state.stats.provas} prova(s) · {state.stats.questoes} questão(ões) criadas.
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

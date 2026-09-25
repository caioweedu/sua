"use client";

import { useState, useTransition } from "react";

// Onda 3 · exclusão de vitrine com escolha do que remover.
// Abre uma confirmação: por padrão remove só a vitrine (produtos viram "sem
// vitrine"); com o checkbox marcado, exclui também os produtos e todo o
// conteúdo (módulos, aulas, provas, certificados) em cascata.
export default function DeleteVitrineButton({
  action,
  vitrineName,
  productCount,
}: {
  action: (apagarProdutos: boolean) => Promise<void>;
  vitrineName: string;
  productCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [pending, start] = useTransition();

  function confirmar() {
    start(async () => {
      await action(apagar);
      setOpen(false);
      setApagar(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-xs text-red-500 hover:underline"
      >
        remover
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ink">Remover vitrine</h3>
            <p className="mt-1 text-sm text-slate-600">
              Remover a vitrine <strong>{vitrineName}</strong>
              {productCount > 0 ? (
                <>, que contém <strong>{productCount} produto(s)</strong>.</>
              ) : (
                "."
              )}
            </p>

            <label className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={apagar}
                onChange={(e) => setApagar(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold text-ink">Excluir também os produtos desta vitrine</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Remove os produtos e todos os módulos, aulas, provas e certificados. Ação irreversível.
                </span>
              </span>
            </label>

            {!apagar && productCount > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Sem marcar, os {productCount} produto(s) continuam salvos como “sem vitrine”.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="btn-outline text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={pending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Removendo…" : apagar ? "Excluir vitrine e produtos" : "Remover vitrine"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

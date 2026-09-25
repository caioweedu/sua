"use client";

import { useState, useTransition } from "react";

// Onda 3 · exclusão de produto (trilha) com confirmação. Remove o produto e
// todo o conteúdo (módulos, aulas, provas, certificados) em cascata.
export default function DeleteProductButton({
  action,
  name,
}: {
  action: () => Promise<void>;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirmar() {
    start(async () => {
      await action();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 hover:underline"
      >
        excluir
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
            <h3 className="text-lg font-bold text-ink">Excluir produto</h3>
            <p className="mt-1 text-sm text-slate-600">
              Excluir <strong>{name}</strong> e todo o conteúdo dele (módulos, aulas,
              provas e certificados)? Ação irreversível.
            </p>
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
                {pending ? "Excluindo…" : "Excluir produto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

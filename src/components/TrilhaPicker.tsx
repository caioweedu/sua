"use client";

import { useState } from "react";

// Onda 3 · F3 — seletor de treinamentos do planejamento. Cada vitrine tem um
// "marcar toda a vitrine" (com estado indeterminado quando só alguns estão
// marcados) que liga/desliga todos os seus treinamentos de uma vez. Os
// checkboxes individuais mantêm name="trilhaIds" — o server action não muda.

type VitrineOpt = { id: string; name: string; trilhas: { id: string; title: string }[] };

export default function TrilhaPicker({
  vitrines,
  orphans,
}: {
  vitrines: VitrineOpt[];
  orphans: { id: string; title: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function setMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) (on ? next.add(id) : next.delete(id));
      return next;
    });
  }

  function Box({ id, title }: { id: string; title: string }) {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="trilhaIds"
          value={id}
          checked={selected.has(id)}
          onChange={(e) => setMany([id], e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        {title}
      </label>
    );
  }

  return (
    <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
      {vitrines.map((v) => {
        const ids = v.trilhas.map((t) => t.id);
        const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
        const someOn = ids.some((id) => selected.has(id));
        return (
          <div key={v.id}>
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = !allOn && someOn;
                }}
                onChange={(e) => setMany(ids, e.target.checked)}
              />
              🗂️ {v.name} <span className="font-normal text-slate-400">· toda a vitrine</span>
            </label>
            <div className="grid gap-1 pl-6 sm:grid-cols-2">
              {v.trilhas.map((t) => (
                <Box key={t.id} id={t.id} title={t.title} />
              ))}
            </div>
          </div>
        );
      })}
      {orphans.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Sem vitrine</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {orphans.map((t) => (
              <Box key={t.id} id={t.id} title={t.title} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

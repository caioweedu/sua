"use client";

import { useState } from "react";

type Card = { id: string; front: string; back: string };

export default function FlashcardStudy({ cards }: { cards: Card[] }) {
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (cards.length === 0) return null;

  const idx = order[pos] ?? 0;
  const card = cards[idx];

  function go(delta: number) {
    setFlipped(false);
    setPos((p) => {
      const n = p + delta;
      if (n < 0) return cards.length - 1;
      if (n >= cards.length) return 0;
      return n;
    });
  }

  function shuffle() {
    const arr = cards.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setOrder(arr);
    setPos(0);
    setFlipped(false);
  }

  return (
    <div className="card mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-ink">🃏 Flashcards de estudo</h3>
        <span className="text-xs text-slate-400">
          {pos + 1} / {cards.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Mostrar a frente" : "Mostrar o verso"}
        className="flex min-h-[150px] w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center transition hover:border-brand"
      >
        <span className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {flipped ? "Verso" : "Frente"}
        </span>
        <span className="text-base font-medium text-ink">
          {flipped ? card.back : card.front}
        </span>
        <span className="mt-3 text-xs text-slate-400">
          {flipped ? "toque para voltar" : "toque para revelar"}
        </span>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button className="btn-outline text-sm" onClick={() => go(-1)}>
          ← Anterior
        </button>
        <button className="btn-ghost text-sm" onClick={shuffle}>
          🔀 Embaralhar
        </button>
        <button className="btn-outline text-sm" onClick={() => go(1)}>
          Próximo →
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addFlashcard,
  deleteFlashcard,
  adicionarFlashcards,
} from "@/lib/actions/flashcards";
import type { PropostaFlashcard } from "@/lib/copiloto";

type Card = { id: string; front: string; back: string };
type Phase = "idle" | "generating" | "review" | "saving";

export default function FlashcardsCard({
  trilhaId,
  cards,
}: {
  trilhaId: string;
  cards: Card[];
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const [texto, setTexto] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [num, setNum] = useState(10);
  const [gerados, setGerados] = useState<PropostaFlashcard[]>([]);

  async function gerar() {
    setError(null);
    if (!texto.trim() && !file) {
      setError("Cole um texto ou envie um PDF.");
      return;
    }
    setPhase("generating");
    try {
      const fd = new FormData();
      fd.set("trilhaId", trilhaId);
      fd.set("texto", texto);
      fd.set("num", String(num));
      if (file) fd.set("pdf", file);
      const res = await fetch("/api/admin/copiloto/flashcards", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao gerar.");
      setGerados(data.flashcards as PropostaFlashcard[]);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar.");
      setPhase("idle");
    }
  }

  async function adicionar() {
    if (gerados.length === 0) return;
    setError(null);
    setPhase("saving");
    try {
      const r = await adicionarFlashcards({ trilhaId, flashcards: gerados });
      if (!r.ok) throw new Error(r.error || "Falha ao adicionar.");
      setGerados([]);
      setTexto("");
      setFile(null);
      setAiOpen(false);
      setPhase("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao adicionar.");
      setPhase("review");
    }
  }

  function setG(fn: (g: PropostaFlashcard[]) => PropostaFlashcard[]) {
    setGerados((cur) => fn(cur));
  }

  const busy = phase === "generating" || phase === "saving";

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">Flashcards de estudo</h2>
        <span className="text-xs text-slate-400">{cards.length} card(s)</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Cards de revisão (frente/verso) que o aluno estuda na página do produto.
      </p>

      {/* Lista atual */}
      {cards.length > 0 && (
        <ul className="mb-4 space-y-2">
          {cards.map((c) => (
            <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{c.front}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{c.back}</p>
                </div>
                <form action={deleteFlashcard.bind(null, c.id, trilhaId)}>
                  <button className="text-xs text-red-500 hover:underline" type="submit">
                    remover
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Adição manual */}
      <form
        action={addFlashcard.bind(null, trilhaId)}
        className="space-y-2 border-t border-slate-100 pt-4"
      >
        <input name="front" required className="input" placeholder="Frente (termo/pergunta)" />
        <textarea name="back" required className="input" rows={2} placeholder="Verso (definição/resposta)" />
        <button className="btn-outline text-sm" type="submit">
          + Adicionar flashcard
        </button>
      </form>

      {/* Geração por IA */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        {!aiOpen ? (
          <button className="btn-brand text-sm" onClick={() => setAiOpen(true)}>
            ✨ Gerar flashcards com IA
          </button>
        ) : (
          <div className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">
                ✨ Gerar flashcards com IA
              </span>
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  setAiOpen(false);
                  setPhase("idle");
                  setGerados([]);
                  setError(null);
                }}
                disabled={busy}
              >
                fechar
              </button>
            </div>

            {phase !== "review" && phase !== "saving" && (
              <>
                <textarea
                  className="input min-h-[100px] text-sm"
                  placeholder="Cole o material (texto da aula, manual, apostila...)"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  disabled={busy}
                />
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={busy}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
                />
                {file && (
                  <p className="text-xs text-slate-500">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Quantos cards</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={num}
                    onChange={(e) => setNum(Number(e.target.value) || 10)}
                    disabled={busy}
                    className="input w-20 py-1.5"
                  />
                </div>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <button className="btn-brand text-sm" onClick={gerar} disabled={busy}>
                  {phase === "generating" ? "Gerando..." : "Gerar"}
                </button>
              </>
            )}

            {(phase === "review" || phase === "saving") && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Revise e ajuste. Nada é salvo até você adicionar.
                </p>
                {gerados.map((g, gi) => (
                  <div key={gi} className="rounded-lg bg-white p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        className="input py-1 text-sm"
                        value={g.front}
                        onChange={(e) =>
                          setG((gs) =>
                            gs.map((x, i) =>
                              i === gi ? { ...x, front: e.target.value } : x
                            )
                          )
                        }
                        placeholder="Frente"
                      />
                      <button
                        className="btn-ghost text-sm text-red-600"
                        disabled={busy}
                        onClick={() => setG((gs) => gs.filter((_, i) => i !== gi))}
                        aria-label="Remover flashcard"
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      className="input min-h-[40px] text-sm"
                      value={g.back}
                      onChange={(e) =>
                        setG((gs) =>
                          gs.map((x, i) =>
                            i === gi ? { ...x, back: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Verso"
                    />
                  </div>
                ))}
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-brand text-sm"
                    onClick={adicionar}
                    disabled={busy || gerados.length === 0}
                  >
                    {phase === "saving"
                      ? "Adicionando..."
                      : `Adicionar ${gerados.length} ao deck`}
                  </button>
                  <button
                    className="btn-outline text-sm"
                    onClick={() => setPhase("idle")}
                    disabled={busy}
                  >
                    ← Gerar outros
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

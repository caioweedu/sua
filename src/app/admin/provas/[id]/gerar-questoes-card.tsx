"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adicionarQuestoes } from "@/lib/actions/copiloto";
import type { PropostaQuestao } from "@/lib/copiloto";

type Phase = "input" | "generating" | "review" | "saving";

export default function GerarQuestoesCard({ examId }: { examId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [texto, setTexto] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [num, setNum] = useState(5);
  const [questoes, setQuestoes] = useState<PropostaQuestao[]>([]);

  async function gerar() {
    setError(null);
    if (!texto.trim() && !file) {
      setError("Cole um texto ou envie um PDF.");
      return;
    }
    setPhase("generating");
    try {
      const fd = new FormData();
      fd.set("examId", examId);
      fd.set("texto", texto);
      fd.set("num", String(num));
      if (file) fd.set("pdf", file);
      const res = await fetch("/api/admin/copiloto/questoes", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao gerar.");
      setQuestoes(data.questoes as PropostaQuestao[]);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar.");
      setPhase("input");
    }
  }

  async function adicionar() {
    if (questoes.length === 0) return;
    setError(null);
    setPhase("saving");
    try {
      const r = await adicionarQuestoes({ examId, questoes });
      if (!r.ok) throw new Error(r.error || "Falha ao adicionar.");
      // Limpa e atualiza a lista renderizada no servidor.
      setQuestoes([]);
      setTexto("");
      setFile(null);
      setPhase("input");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao adicionar.");
      setPhase("review");
    }
  }

  function setQ(fn: (q: PropostaQuestao[]) => PropostaQuestao[]) {
    setQuestoes((cur) => fn(cur));
  }

  if (!open) {
    return (
      <div className="mt-4 border-t border-slate-100 pt-4">
        <button className="btn-outline text-sm" onClick={() => setOpen(true)}>
          ✨ Gerar questões com IA
        </button>
      </div>
    );
  }

  const busy = phase === "generating" || phase === "saving";

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">✨ Gerar questões com IA</span>
        <button
          className="btn-ghost text-xs"
          onClick={() => {
            setOpen(false);
            setPhase("input");
            setQuestoes([]);
            setError(null);
          }}
          disabled={busy}
        >
          fechar
        </button>
      </div>

      {phase !== "review" && (
        <>
          <textarea
            className="input min-h-[120px] text-sm"
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
            <label className="text-sm text-slate-600">Quantas questões</label>
            <input
              type="number"
              min={1}
              max={20}
              value={num}
              onChange={(e) => setNum(Number(e.target.value) || 5)}
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

      {phase === "review" || phase === "saving" ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Revise e ajuste. Marque a alternativa correta. Nada é salvo até você
            adicionar.
          </p>
          {questoes.map((q, qi) => (
            <div key={qi} className="rounded-lg bg-white p-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-2 text-xs font-medium text-slate-500">
                  {qi + 1}
                </span>
                <textarea
                  className="input min-h-[44px] text-sm"
                  value={q.enunciado}
                  onChange={(e) =>
                    setQ((qs) =>
                      qs.map((x, i) =>
                        i === qi ? { ...x, enunciado: e.target.value } : x
                      )
                    )
                  }
                />
                <button
                  className="btn-ghost text-sm text-red-600"
                  disabled={busy}
                  onClick={() => setQ((qs) => qs.filter((_, i) => i !== qi))}
                  aria-label="Remover questão"
                >
                  ✕
                </button>
              </div>
              <div className="mt-1.5 space-y-1 pl-6">
                {q.alternativas.map((alt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`gq-correta-${qi}`}
                      checked={q.correta === oi}
                      onChange={() =>
                        setQ((qs) =>
                          qs.map((x, i) => (i === qi ? { ...x, correta: oi } : x))
                        )
                      }
                      className="h-4 w-4 accent-brand"
                    />
                    <input
                      className="input py-1 text-sm"
                      value={alt}
                      onChange={(e) =>
                        setQ((qs) =>
                          qs.map((x, i) =>
                            i === qi
                              ? {
                                  ...x,
                                  alternativas: x.alternativas.map((y, j) =>
                                    j === oi ? e.target.value : y
                                  ),
                                }
                              : x
                          )
                        )
                      }
                    />
                    <button
                      className="btn-ghost text-sm text-red-600"
                      disabled={busy || q.alternativas.length <= 2}
                      onClick={() =>
                        setQ((qs) =>
                          qs.map((x, i) => {
                            if (i !== qi) return x;
                            const alternativas = x.alternativas.filter(
                              (_, j) => j !== oi
                            );
                            const correta =
                              x.correta === oi
                                ? 0
                                : x.correta > oi
                                ? x.correta - 1
                                : x.correta;
                            return { ...x, alternativas, correta };
                          })
                        )
                      }
                      aria-label="Remover alternativa"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {q.alternativas.length < 6 && (
                  <button
                    className="btn-ghost text-xs text-brand"
                    disabled={busy}
                    onClick={() =>
                      setQ((qs) =>
                        qs.map((x, i) =>
                          i === qi
                            ? { ...x, alternativas: [...x.alternativas, ""] }
                            : x
                        )
                      )
                    }
                  >
                    + Alternativa
                  </button>
                )}
              </div>
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
              disabled={busy || questoes.length === 0}
            >
              {phase === "saving"
                ? "Adicionando..."
                : `Adicionar ${questoes.length} ao banco`}
            </button>
            <button
              className="btn-outline text-sm"
              onClick={() => setPhase("input")}
              disabled={busy}
            >
              ← Gerar outras
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

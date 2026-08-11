"use client";

import { useState } from "react";
import Link from "next/link";
import { publicarCurso, type PublicarResult } from "@/lib/actions/copiloto";
import type {
  PropostaCurso,
  PropostaModulo,
  PropostaQuestao,
} from "@/lib/copiloto";

type Vitrine = { id: string; name: string };
type Phase = "input" | "generating" | "review" | "publishing" | "done";

export default function CopilotoClient({ vitrines }: { vitrines: Vitrine[] }) {
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);

  const [texto, setTexto] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [numQuestoes, setNumQuestoes] = useState(6);

  const [proposta, setProposta] = useState<PropostaCurso | null>(null);
  const [vitrineId, setVitrineId] = useState<string>("");
  const [publicar, setPublicar] = useState(false);
  const [result, setResult] = useState<PublicarResult | null>(null);

  async function gerar() {
    setError(null);
    if (!texto.trim() && !file) {
      setError("Cole um texto ou envie um PDF.");
      return;
    }
    setPhase("generating");
    try {
      const fd = new FormData();
      fd.set("texto", texto);
      fd.set("numQuestoes", String(numQuestoes));
      if (file) fd.set("pdf", file);
      const res = await fetch("/api/admin/copiloto", { method: "POST", body: fd });
      const raw = await res.text();
      let data: { proposta?: PropostaCurso; error?: string } | null = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        // Resposta não-JSON = erro de plataforma (ex.: tempo limite da função).
      }
      if (!res.ok || !data?.proposta) {
        throw new Error(
          data?.error ||
            "A geração falhou (o servidor pode ter excedido o tempo limite). Tente um material menor ou tente novamente."
        );
      }
      setProposta(data.proposta);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar.");
      setPhase("input");
    }
  }

  async function publicarAgora() {
    if (!proposta) return;
    setError(null);
    setPhase("publishing");
    try {
      const r = await publicarCurso({
        proposta,
        vitrineId: vitrineId || null,
        publicar,
      });
      if (!r.ok) throw new Error(r.error || "Falha ao publicar.");
      setResult(r);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao publicar.");
      setPhase("review");
    }
  }

  // Helpers de edição imutável da proposta.
  function patch(p: Partial<PropostaCurso>) {
    setProposta((cur) => (cur ? { ...cur, ...p } : cur));
  }
  function setModulos(fn: (m: PropostaModulo[]) => PropostaModulo[]) {
    setProposta((cur) => (cur ? { ...cur, modulos: fn(cur.modulos) } : cur));
  }
  function setQuiz(fn: (q: PropostaQuestao[]) => PropostaQuestao[]) {
    setProposta((cur) => (cur ? { ...cur, quiz: fn(cur.quiz) } : cur));
  }

  // ------------------------------------------------------------------ DONE
  if (phase === "done" && result?.ok) {
    return (
      <div className="card">
        <h2 className="mb-1 text-lg font-semibold">✓ Curso criado</h2>
        <p className="mb-4 text-sm text-slate-600">
          {result.stats?.modulos} módulo(s) · {result.stats?.aulas} aula(s) ·{" "}
          {result.stats?.questoes} questão(ões).{" "}
          {publicar ? "Publicado." : "Criado como rascunho (não publicado)."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/trilhas/${result.trilhaId}`} className="btn-brand">
            Abrir e refinar o produto
          </Link>
          <button
            className="btn-outline"
            onClick={() => {
              setPhase("input");
              setProposta(null);
              setResult(null);
              setTexto("");
              setFile(null);
              setPublicar(false);
              setVitrineId("");
            }}
          >
            Criar outro
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- REVIEW
  if ((phase === "review" || phase === "publishing") && proposta) {
    const busy = phase === "publishing";
    return (
      <div className="space-y-6">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Revise e ajuste</h2>
            <button
              className="btn-ghost text-sm"
              onClick={() => setPhase("input")}
              disabled={busy}
            >
              ← Recomeçar
            </button>
          </div>
          <p className="text-sm text-slate-500">
            A IA propôs a estrutura abaixo. Edite o que quiser — nada é criado até
            você publicar.
          </p>

          <div>
            <label className="label">Título do produto</label>
            <input
              className="input"
              value={proposta.titulo}
              onChange={(e) => patch({ titulo: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input min-h-[70px]"
              value={proposta.descricao}
              onChange={(e) => patch({ descricao: e.target.value })}
            />
          </div>
        </div>

        {/* Módulos e aulas */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Módulos e aulas</h3>
            <button
              className="btn-outline text-sm"
              disabled={busy}
              onClick={() =>
                setModulos((ms) => [...ms, { titulo: "Novo módulo", aulas: [] }])
              }
            >
              + Módulo
            </button>
          </div>

          {proposta.modulos.map((m, mi) => (
            <div key={mi} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="chip chip-brand">Módulo {mi + 1}</span>
                <input
                  className="input py-1.5"
                  value={m.titulo}
                  onChange={(e) =>
                    setModulos((ms) =>
                      ms.map((x, i) =>
                        i === mi ? { ...x, titulo: e.target.value } : x
                      )
                    )
                  }
                />
                <button
                  className="btn-ghost text-sm text-red-600"
                  disabled={busy}
                  onClick={() => setModulos((ms) => ms.filter((_, i) => i !== mi))}
                  aria-label="Remover módulo"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 pl-2">
                {m.aulas.map((a, ai) => (
                  <div key={ai} className="rounded-lg bg-slate-50 p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        {mi + 1}.{ai + 1}
                      </span>
                      <input
                        className="input py-1.5 text-sm"
                        value={a.titulo}
                        onChange={(e) =>
                          setModulos((ms) =>
                            ms.map((x, i) =>
                              i === mi
                                ? {
                                    ...x,
                                    aulas: x.aulas.map((y, j) =>
                                      j === ai ? { ...y, titulo: e.target.value } : y
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                      />
                      <button
                        className="btn-ghost text-sm text-red-600"
                        disabled={busy}
                        onClick={() =>
                          setModulos((ms) =>
                            ms.map((x, i) =>
                              i === mi
                                ? { ...x, aulas: x.aulas.filter((_, j) => j !== ai) }
                                : x
                            )
                          )
                        }
                        aria-label="Remover aula"
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      className="input mt-1 min-h-[48px] text-sm"
                      placeholder="Resumo da aula"
                      value={a.resumo}
                      onChange={(e) =>
                        setModulos((ms) =>
                          ms.map((x, i) =>
                            i === mi
                              ? {
                                  ...x,
                                  aulas: x.aulas.map((y, j) =>
                                    j === ai ? { ...y, resumo: e.target.value } : y
                                  ),
                                }
                              : x
                          )
                        )
                      }
                    />
                  </div>
                ))}
                <button
                  className="btn-ghost text-sm text-brand"
                  disabled={busy}
                  onClick={() =>
                    setModulos((ms) =>
                      ms.map((x, i) =>
                        i === mi
                          ? { ...x, aulas: [...x.aulas, { titulo: "Nova aula", resumo: "" }] }
                          : x
                      )
                    )
                  }
                >
                  + Aula
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quiz */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Avaliação (quiz)</h3>
            <button
              className="btn-outline text-sm"
              disabled={busy}
              onClick={() =>
                setQuiz((qs) => [
                  ...qs,
                  { enunciado: "Nova questão", alternativas: ["", ""], correta: 0 },
                ])
              }
            >
              + Questão
            </button>
          </div>

          {proposta.quiz.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-start gap-2">
                <span className="chip chip-brand mt-2">Q{qi + 1}</span>
                <textarea
                  className="input min-h-[48px]"
                  value={q.enunciado}
                  onChange={(e) =>
                    setQuiz((qs) =>
                      qs.map((x, i) =>
                        i === qi ? { ...x, enunciado: e.target.value } : x
                      )
                    )
                  }
                />
                <button
                  className="btn-ghost text-sm text-red-600"
                  disabled={busy}
                  onClick={() => setQuiz((qs) => qs.filter((_, i) => i !== qi))}
                  aria-label="Remover questão"
                >
                  ✕
                </button>
              </div>
              <p className="mb-1 pl-1 text-xs text-slate-500">
                Marque a alternativa correta:
              </p>
              <div className="space-y-1.5 pl-1">
                {q.alternativas.map((alt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correta-${qi}`}
                      checked={q.correta === oi}
                      onChange={() =>
                        setQuiz((qs) =>
                          qs.map((x, i) => (i === qi ? { ...x, correta: oi } : x))
                        )
                      }
                      className="h-4 w-4 accent-brand"
                    />
                    <input
                      className="input py-1.5 text-sm"
                      value={alt}
                      onChange={(e) =>
                        setQuiz((qs) =>
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
                        setQuiz((qs) =>
                          qs.map((x, i) => {
                            if (i !== qi) return x;
                            const alternativas = x.alternativas.filter((_, j) => j !== oi);
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
                    className="btn-ghost text-sm text-brand"
                    disabled={busy}
                    onClick={() =>
                      setQuiz((qs) =>
                        qs.map((x, i) =>
                          i === qi ? { ...x, alternativas: [...x.alternativas, ""] } : x
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
        </div>

        {/* Publicar */}
        <div className="card space-y-4">
          <h3 className="font-semibold">Onde criar</h3>
          <div>
            <label className="label">Vitrine (opcional)</label>
            <select
              className="input"
              value={vitrineId}
              onChange={(e) => setVitrineId(e.target.value)}
            >
              <option value="">— Sem vitrine (organizar depois)</option>
              {vitrines.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={publicar}
              onChange={(e) => setPublicar(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Publicar imediatamente (senão fica como rascunho)
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button className="btn-brand" onClick={publicarAgora} disabled={busy}>
            {busy ? "Criando..." : "Publicar curso"}
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- INPUT
  const generating = phase === "generating";
  return (
    <div className="card space-y-4">
      <div>
        <label className="label">Cole o material do treinamento</label>
        <textarea
          className="input min-h-[180px]"
          placeholder="Cole aqui um manual, política, roteiro, apostila..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={generating}
        />
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 p-3">
        <label className="label">…ou envie um PDF</label>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={generating}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
        />
        {file && (
          <p className="mt-1 text-xs text-slate-500">
            {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="label mb-0">Questões no quiz</label>
        <input
          type="number"
          min={3}
          max={15}
          value={numQuestoes}
          onChange={(e) => setNumQuestoes(Number(e.target.value) || 6)}
          disabled={generating}
          className="input w-20 py-1.5"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button className="btn-brand" onClick={gerar} disabled={generating}>
        {generating ? "Gerando estrutura..." : "✨ Gerar curso com IA"}
      </button>
      {generating && (
        <p className="text-xs text-slate-500">
          A IA está lendo o material e montando módulos, aulas e quiz. Isso pode
          levar alguns segundos.
        </p>
      )}
    </div>
  );
}

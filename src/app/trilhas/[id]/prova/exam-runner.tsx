"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gradeExam, type GradeResult } from "@/lib/actions/exam";

type Q = {
  id: string;
  statement: string;
  options: { id: string; text: string }[];
};

export default function ExamRunner({
  examId,
  questions,
}: {
  examId: string;
  questions: Q[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [pending, startTransition] = useTransition();

  const allAnswered = questions.every((q) => answers[q.id]);

  function submit() {
    const payload = questions.map((q) => ({
      questionId: q.id,
      optionId: answers[q.id],
    }));
    startTransition(async () => {
      const res = await gradeExam(examId, payload);
      setResult(res);
    });
  }

  if (result?.ok) {
    // Mapa de correção para a revisão (só chega quando a prova permite gabarito).
    const detailByQuestion = new Map(
      (result.details ?? []).map((d) => [d.questionId, d])
    );
    return (
      <div className="space-y-4">
        <div className="card text-center">
          <div className="text-5xl">{result.passed ? "🎉" : "😕"}</div>
          <h2 className="mt-3 text-xl font-bold">
            {result.passed ? "Aprovado!" : "Não foi dessa vez"}
          </h2>
          <p className="mt-1 text-slate-500">
            Você acertou {result.score}% (mínimo {result.passingScore}%).
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {result.passed && result.certificateCode ? (
              <a href={`/certificados/${result.certificateCode}`} className="btn-brand">
                🏆 Ver certificado
              </a>
            ) : (
              <button className="btn-brand" onClick={() => router.refresh()}>
                Tentar novamente
              </button>
            )}
            <a href="/dashboard" className="btn-outline">
              Voltar ao painel
            </a>
          </div>
        </div>

        {result.showAnswers && result.details && (
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Revisão das respostas
            </h3>
            <div className="space-y-4">
              {questions.map((q, i) => {
                const d = detailByQuestion.get(q.id);
                return (
                  <div key={q.id} className="card">
                    <p className="mb-3 font-medium">
                      {i + 1}. {q.statement}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((o) => {
                        const isCorrect = d?.correctOptionId === o.id;
                        const isSelected = d?.selectedOptionId === o.id;
                        return (
                          <div
                            key={o.id}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                              isCorrect
                                ? "border-green-300 bg-green-50"
                                : isSelected
                                ? "border-red-300 bg-red-50"
                                : "border-slate-200"
                            }`}
                          >
                            <span className="w-5 shrink-0 text-center">
                              {isCorrect ? "✓" : isSelected ? "✗" : ""}
                            </span>
                            <span
                              className={
                                isCorrect
                                  ? "font-medium text-green-700"
                                  : isSelected
                                  ? "text-red-700"
                                  : "text-slate-600"
                              }
                            >
                              {o.text}
                            </span>
                            {isSelected && (
                              <span className="ml-auto text-xs text-slate-400">
                                sua resposta
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={q.id} className="card">
          <p className="mb-3 font-medium">
            {i + 1}. {q.statement}
          </p>
          <div className="space-y-2">
            {q.options.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                  answers[q.id] === o.id
                    ? "border-brand bg-slate-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === o.id}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                />
                <span>{o.text}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        className="btn-brand w-full"
        disabled={!allAnswered || pending}
        onClick={submit}
      >
        {pending ? "Corrigindo..." : "Enviar respostas"}
      </button>
      {!allAnswered && (
        <p className="text-center text-sm text-slate-400">
          Responda todas as questões para enviar.
        </p>
      )}
    </div>
  );
}

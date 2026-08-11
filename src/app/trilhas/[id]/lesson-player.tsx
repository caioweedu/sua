"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toggleAulaComplete, completeAndGo } from "@/lib/actions/learning";
import SubmitButton from "@/components/SubmitButton";
import type { VideoProvider } from "@/lib/video";

// Fração do vídeo que consideramos "assistido" (95%), para não exigir os
// segundos finais de créditos/silêncio.
const WATCHED_RATIO = 0.95;
// Se o player do Panda não emitir NENHUM evento neste tempo (embed antigo, sem
// telemetria), liberamos o avanço para não travar o aluno de vez (fail-open).
const NO_TELEMETRY_GRACE_MS = 20000;

type Props = {
  embed: string | null;
  provider: VideoProvider;
  title: string;
  description: string | null;
  pdfUrl: string | null;
  indexLabel: number;
  isStudent: boolean;
  currentDone: boolean;
  currentId: string | null;
  trilhaId: string;
  nextAulaId: string | null;
};

export default function LessonPlayer({
  embed,
  provider,
  title,
  description,
  pdfUrl,
  indexLabel,
  isStudent,
  currentDone,
  currentId,
  trilhaId,
  nextAulaId,
}: Props) {
  // Só travamos o avanço em vídeo do Panda, para aluno, na aula ainda não
  // concluída. Nos demais casos o avanço já começa liberado.
  const gated = isStudent && !currentDone && provider === "panda" && !!embed;
  const [watched, setWatched] = useState(!gated);
  const gotEventRef = useRef(false);

  useEffect(() => {
    // Reinicia a trava quando muda de aula.
    setWatched(!gated);
    gotEventRef.current = false;
    if (!gated) return;

    const durationRef = { value: 0 };

    function markWatched() {
      setWatched(true);
    }

    function onMessage(e: MessageEvent) {
      // Aceita somente mensagens vindas do player do Panda.
      if (typeof e.origin === "string" && !e.origin.includes("pandavideo")) return;

      let data: unknown = e.data;
      if (typeof data === "string") {
        if (!data.includes("panda")) return;
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const d = data as Record<string, unknown>;
      const type = String(d.message ?? d.event ?? d.type ?? "");
      if (!type.startsWith("panda")) return;

      gotEventRef.current = true;

      // Fim do vídeo.
      if (/ended|complete|finish/i.test(type)) {
        markWatched();
        return;
      }

      // Guarda a maior duração vista (nem todo evento traz).
      const dur = Number(d.duration ?? d.videoDuration ?? 0);
      if (dur > 0) durationRef.value = Math.max(durationRef.value, dur);

      // Progresso por tempo.
      const ct = Number(d.currentTime ?? d.currentTimeInSeconds ?? 0);
      if (durationRef.value > 0 && ct / durationRef.value >= WATCHED_RATIO) {
        markWatched();
      }
    }

    window.addEventListener("message", onMessage);

    // Fail-open: se nada chegou do player, libera para não prender o aluno.
    const grace = window.setTimeout(() => {
      if (!gotEventRef.current) setWatched(true);
    }, NO_TELEMETRY_GRACE_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(grace);
    };
  }, [gated, currentId]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-card">
        <div className="aspect-video">
          {embed ? (
            <iframe
              src={embed}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={title}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              {currentId ? "Esta aula ainda não tem vídeo." : "Selecione uma aula para assistir"}
            </div>
          )}
        </div>
      </div>

      {currentId && (
        <div className="mt-4">
          <h2 className="text-lg font-bold text-ink">
            {indexLabel}. {title}
          </h2>
          {description && <p className="mt-1 text-slate-600">{description}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand hover:text-brand"
              >
                📎 Material de apoio (PDF)
              </a>
            )}

            {isStudent ? (
              currentDone ? (
                <>
                  <form action={toggleAulaComplete.bind(null, currentId, trilhaId, false)}>
                    <SubmitButton
                      pendingText="Salvando…"
                      className="inline-flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-100"
                    >
                      ✓ Aula concluída
                    </SubmitButton>
                  </form>
                  {nextAulaId && (
                    <Link href={`/trilhas/${trilhaId}?a=${nextAulaId}`} className="btn-brand">
                      Próxima aula →
                    </Link>
                  )}
                </>
              ) : gated && !watched ? (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500"
                  >
                    🔒 {nextAulaId ? "Concluir e avançar →" : "Concluir aula"}
                  </button>
                  <span className="text-xs text-slate-400">
                    Assista o vídeo até o fim para liberar.
                  </span>
                </div>
              ) : (
                <form action={completeAndGo.bind(null, currentId, trilhaId, nextAulaId)}>
                  <SubmitButton className="btn-brand" pendingText="Salvando…">
                    {nextAulaId ? "Concluir e avançar →" : "Concluir aula"}
                  </SubmitButton>
                </form>
              )
            ) : (
              nextAulaId && (
                <Link href={`/trilhas/${trilhaId}?a=${nextAulaId}`} className="btn-outline">
                  Próxima aula →
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

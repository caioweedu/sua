"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export type Slide = {
  id: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

// Banner rotativo do topo da home (estilo Netflix/Prime): imagens que giram
// sozinhas, com texto e link opcionais. Pausa no hover, respeita
// prefers-reduced-motion e permite navegar por setas/bolinhas.
export default function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((to: number) => setI((to + n) % n), [n]);

  useEffect(() => {
    if (n <= 1 || paused) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    timer.current = setInterval(() => setI((c) => (c + 1) % n), 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [n, paused]);

  if (n === 0) return null;

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative min-h-[300px] sm:min-h-[440px]">
        {slides.map((s, idx) => {
          const inner = (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${s.imageUrl})` }}
              />
              <div className="s-fade-bottom absolute inset-0" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
              {(s.title || s.subtitle || s.ctaLabel) && (
                <div className="relative mx-auto flex h-full max-w-6xl items-end px-4 pb-14 sm:pb-16">
                  <div className="max-w-xl">
                    {s.title && (
                      <h2 className="text-3xl font-black leading-tight text-white drop-shadow sm:text-5xl">
                        {s.title}
                      </h2>
                    )}
                    {s.subtitle && (
                      <p className="mt-2 text-white/85 drop-shadow sm:text-lg">{s.subtitle}</p>
                    )}
                    {s.ctaLabel && (
                      <span className="btn-brand mt-5 inline-flex">{s.ctaLabel}</span>
                    )}
                  </div>
                </div>
              )}
            </>
          );
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                idx === i ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-hidden={idx !== i}
            >
              {s.ctaHref ? (
                s.ctaHref.startsWith("http") ? (
                  <a href={s.ctaHref} target="_blank" rel="noopener noreferrer" className="block h-full">
                    {inner}
                  </a>
                ) : (
                  <Link href={s.ctaHref} className="block h-full">
                    {inner}
                  </Link>
                )
              ) : (
                <div className="h-full">{inner}</div>
              )}
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <>
          {/* Setas */}
          <button
            type="button"
            onClick={() => go(i - 1)}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(i + 1)}
            aria-label="Próximo"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
          >
            ›
          </button>
          {/* Bolinhas */}
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(idx)}
                aria-label={`Ir para o slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

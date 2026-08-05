"use client";

import { useRef, useState } from "react";

// Campo de imagem reutilizável: mostra prévia, permite subir um arquivo
// (Vercel Blob via /api/upload) e mantém um <input hidden> com a URL final para
// ser enviada no submit do form. Se o upload não estiver configurado, o usuário
// ainda pode colar uma URL manualmente.
export default function ImageUpload({
  name,
  label,
  hint,
  defaultValue = "",
  slot,
  aspect = "16 / 9",
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  slot?: string;
  // Proporção da caixa de prévia (CSS aspect-ratio), só visual.
  aspect?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (slot) fd.append("slot", slot);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload.");
      setUrl(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="-mt-1 mb-2 text-xs text-slate-500">{hint}</p>}

      <div className="flex items-start gap-3">
        {/* Prévia */}
        <div
          className="flex w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-300"
          style={{ aspectRatio: aspect }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">🖼️</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "Enviando…" : url ? "Trocar imagem" : "Enviar imagem"}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="ml-2 text-sm text-slate-400 hover:text-red-500"
            >
              Remover
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {/* Alternativa: colar a URL diretamente. */}
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input"
            placeholder="ou cole a URL da imagem"
          />
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      </div>

      {/* Valor enviado no submit do form. */}
      <input type="hidden" name={name} value={url} />
    </div>
  );
}

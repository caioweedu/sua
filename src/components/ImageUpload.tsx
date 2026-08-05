"use client";

import { useRef, useState } from "react";

// Redimensiona/otimiza a imagem no navegador antes de subir: reduz muito o
// tamanho (páginas mais leves) e garante que o arquivo caiba no upload simples.
// SVG passa direto (vetor). Mantém PNG (transparência) ou converte foto p/ JPEG.
async function optimize(file: File, maxW: number, maxH: number): Promise<Blob> {
  if (file.type === "image/svg+xml") return file;
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  const isPng = file.type === "image/png";
  const type = isPng ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob((b) => res(b), type, isPng ? undefined : 0.85)
  );
  return blob ?? file;
}

// Campo de imagem reutilizável: prévia + envio de arquivo (otimizado) + colar
// URL como alternativa. Mantém um <input hidden> com a URL final para o form.
export default function ImageUpload({
  name,
  label,
  hint,
  defaultValue = "",
  slot,
  aspect = "16 / 9",
  maxW = 1920,
  maxH = 1920,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  slot?: string;
  aspect?: string;
  maxW?: number;
  maxH?: number;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const optimized = await optimize(file, maxW, maxH);
      const ext = file.type === "image/png" ? "png" : file.type === "image/svg+xml" ? "svg" : "jpg";
      const fd = new FormData();
      fd.append("file", optimized, `${slot ?? "img"}.${ext}`);
      if (slot) fd.append("slot", slot);

      // Timeout de segurança: nunca fica preso em "Enviando..." pra sempre.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      let res: Response;
      try {
        res = await fetch("/api/upload", { method: "POST", body: fd, signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(text.slice(0, 120) || `Erro ${res.status}.`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}.`);
      setUrl(data.url);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setErr("Tempo esgotado ao enviar. Verifique a conexão e tente de novo, ou cole a URL.");
      } else {
        setErr(e instanceof Error ? e.message : "Falha no upload.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="-mt-1 mb-2 text-xs text-slate-500">{hint}</p>}

      <div className="flex items-start gap-3">
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
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input"
            placeholder="ou cole a URL da imagem"
          />
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      </div>

      <input type="hidden" name={name} value={url} />
    </div>
  );
}

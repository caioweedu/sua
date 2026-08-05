"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

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
      // Upload direto do navegador para o Blob (sem passar o arquivo pela
      // função serverless), evitando o limite de ~4,5 MB de corpo.
      const pathname = `${slot ?? "img"}/${file.name}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: file.type || undefined,
      });
      setUrl(blob.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no upload.";
      // Erro genérico do cliente quando o servidor não tem o token do Blob.
      setErr(
        /client token/i.test(msg)
          ? "Upload não configurado: falta a variável BLOB_READ_WRITE_TOKEN no projeto (Vercel → Storage → Blob → copiar o token → Settings → Environment Variables). Enquanto isso, cole a URL da imagem."
          : msg
      );
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

"use client";

import { useActionState, useState } from "react";
import { sendAccessLink, type AccessLinkResult } from "@/lib/actions/users";
import SubmitButton from "@/components/SubmitButton";

const initial: AccessLinkResult = { ok: false };

export default function StudentAccessCard({
  userId,
  studentEmail,
  emailConfigured,
}: {
  userId: string;
  studentEmail: string;
  emailConfigured: boolean;
}) {
  const [state, action] = useActionState(sendAccessLink, initial);
  const [copied, setCopied] = useState(false);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignora */
    }
  }

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Acesso do aluno</h2>
      <p className="mb-4 text-xs text-slate-500">
        {emailConfigured
          ? "Envie por e-mail o convite (definir senha) ou a redefinição de senha."
          : "E-mail não configurado — o sistema gera um link para você copiar e enviar (WhatsApp, e-mail próprio)."}
      </p>

      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="userId" value={userId} />
        <SubmitButton
          name="purpose"
          value="INVITE"
          className="btn-brand text-sm"
          pendingText="Gerando…"
        >
          ✉️ Enviar convite
        </SubmitButton>
        <SubmitButton
          name="purpose"
          value="RESET"
          className="btn-outline text-sm"
          pendingText="Gerando…"
        >
          🔑 Redefinir senha (link)
        </SubmitButton>
      </form>

      {state.ok && state.sent && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          ✓ E-mail {state.purpose === "RESET" ? "de redefinição" : "de convite"} enviado para{" "}
          <span className="font-medium">{studentEmail}</span>.
        </p>
      )}

      {state.ok && !state.sent && state.url && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">
            Link de {state.purpose === "RESET" ? "redefinição" : "convite"} gerado
            {state.error ? " (e-mail não enviado)" : ""}:
          </p>
          {state.error && (
            <p className="mt-1 text-xs text-amber-700">Motivo: {state.error}</p>
          )}
          <div className="mt-2 flex gap-2">
            <input readOnly value={state.url} className="input flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => copy(state.url!)} className="btn-outline px-3 text-xs">
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Envie este link ao aluno. Ele expira em 7 dias e só pode ser usado uma vez.
          </p>
        </div>
      )}

      {!state.ok && state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
    </div>
  );
}

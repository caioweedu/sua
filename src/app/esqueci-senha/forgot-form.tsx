"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ForgotState } from "@/lib/actions/auth";

const initial: ForgotState = {};

export default function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.done) {
    return (
      <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
        <p className="font-semibold">Verifique seu e-mail.</p>
        <p className="mt-1">
          Se este e-mail estiver cadastrado, enviamos um link para você redefinir a
          senha. O link vale por 7 dias. Não chegou? Procure o administrador da sua
          universidade.
        </p>
        <a href="/login" className="mt-3 inline-block font-medium text-brand hover:underline">
          ← Voltar ao login
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="voce@empresa.com"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-brand w-full">
        {pending ? "Enviando..." : "Enviar link de redefinição"}
      </button>

      <p className="text-center text-sm">
        <a href="/login" className="text-slate-500 hover:text-ink hover:underline">
          ← Voltar ao login
        </a>
      </p>
    </form>
  );
}

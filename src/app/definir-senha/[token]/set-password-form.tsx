"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setPasswordWithToken, type SetPasswordResult } from "@/lib/actions/users";
import SubmitButton from "@/components/SubmitButton";

const initial: SetPasswordResult = { ok: false };

export default function SetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(
    setPasswordWithToken.bind(null, token),
    initial
  );

  if (state.ok) {
    return (
      <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">✓ Senha definida com sucesso!</p>
        <p className="mt-1">Agora é só entrar com seu e-mail e a nova senha.</p>
        <Link href="/login" className="btn-brand mt-4 inline-block">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Nova senha</label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          className="input"
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <div>
        <label className="label">Confirmar senha</label>
        <input
          name="confirm"
          type="password"
          required
          minLength={6}
          className="input"
          placeholder="Repita a senha"
        />
      </div>
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <SubmitButton className="btn-brand w-full" pendingText="Salvando…">
        Salvar senha
      </SubmitButton>
    </form>
  );
}

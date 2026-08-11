"use client";

import { useFormStatus } from "react-dom";

// Botão de envio que mostra estado "processando" enquanto a server action roda.
// Usa useFormStatus, então deve ser renderizado DENTRO de um <form>.
export default function SubmitButton({
  children,
  className = "btn-brand",
  pendingText,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  // Opcionais: permitem que o botão envie um par name/value no formData
  // (útil quando um mesmo form tem mais de um botão de submit).
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:cursor-wait disabled:opacity-70`}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {pending && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        )}
        {pending ? pendingText ?? children : children}
      </span>
    </button>
  );
}

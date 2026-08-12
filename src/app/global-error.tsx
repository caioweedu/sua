"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Captura erros de renderização do nível mais alto e envia ao Sentry (quando
// o DSN estiver configurado). Sem DSN, apenas mostra a tela de fallback.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 600 }}>
          Algo deu errado
        </h1>
        <p style={{ color: "#666", maxWidth: "420px" }}>
          Ocorreu um erro inesperado. Nossa equipe foi notificada. Tente
          novamente.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}

import * as Sentry from "@sentry/nextjs";

// Só inicializa se o DSN estiver definido. Sem a env var, o Sentry fica
// desligado e o app roda normalmente (mesmo padrão do Resend/Anthropic).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
  });
}

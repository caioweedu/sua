import { PrismaClient } from "@prisma/client";

// A URL do banco pode chegar com nomes diferentes conforme o provedor. A
// integração Neon/Vercel, por exemplo, expõe a conexão como POSTGRES_PRISMA_URL
// (já tunada para Prisma+pooler), DATABASE_URL (pooled) ou DATABASE_URL_UNPOOLED
// (direct). Preferimos a URL já tunada e, na sequência, a conexão com pooler.
function resolveDatasourceUrl(): string | undefined {
  const raw =
    process.env.POSTGRES_PRISMA_URL || // Neon/Vercel: pooled já com pgbouncer
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined;
  if (!raw) return undefined;

  // Em runtime serverless, o Prisma sobre o pooler (PgBouncer) do Neon precisa
  // de `pgbouncer=true` (desliga prepared statements) para não quebrar em
  // requisições com várias queries. Também aumentamos o connect_timeout porque
  // o Neon hiberna e demora a acordar no primeiro acesso. Só aplicamos em URLs
  // com pooler que ainda não tenham esses parâmetros.
  if (raw.includes("-pooler") && !raw.includes("pgbouncer")) {
    const sep = raw.includes("?") ? "&" : "?";
    return `${raw}${sep}pgbouncer=true&connect_timeout=15`;
  }
  return raw;
}

const datasourceUrl = resolveDatasourceUrl();

// Reutiliza a instância do Prisma em desenvolvimento para evitar múltiplas
// conexões durante o hot-reload do Next.js.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

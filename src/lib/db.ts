import { PrismaClient } from "@prisma/client";

// A URL do banco pode chegar com nomes diferentes conforme o provedor. A
// integração Neon/Vercel, por exemplo, às vezes expõe a conexão como
// POSTGRES_PRISMA_URL / POSTGRES_URL em vez de DATABASE_URL. Resolvemos o
// primeiro nome disponível (preferindo a conexão com pooler para runtime
// serverless) e passamos explicitamente ao Prisma, para o app não depender do
// nome exato da variável.
const datasourceUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  undefined;

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

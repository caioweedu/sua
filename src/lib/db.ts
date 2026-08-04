import { PrismaClient } from "@prisma/client";

// Converte um host direto do Neon (ep-xxx.<região>...) no host com pooler
// (ep-xxx-pooler.<região>...). Assim conseguimos derivar a conexão pooled do
// MESMO banco a partir da URL não-pooled.
function toPooledHost(url: string): string {
  return url.replace(/@([^./]+)\./, (full, host: string) =>
    host.endsWith("-pooler") ? full : `@${host}-pooler.`
  );
}

// Resolve a URL do banco para runtime.
//
// Importante: as migrations rodam (no build) sobre o par NÃO-pooled da
// integração (DATABASE_URL_UNPOOLED). Para garantir que o app leia do MESMO
// banco em que as migrations foram aplicadas — mesmo que exista uma
// DATABASE_URL divergente no ambiente — derivamos a conexão de runtime a partir
// dessa mesma variável não-pooled, apenas trocando o endpoint para o com pooler
// (recomendado em serverless). Só caímos para outros nomes quando o par
// não-pooled não existe.
function resolveDatasourceUrl(): string | undefined {
  const unpooled =
    process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;

  let raw: string | undefined;
  if (unpooled) {
    raw = toPooledHost(unpooled);
  } else {
    raw =
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      undefined;
  }
  if (!raw) return undefined;

  // Em runtime serverless, o Prisma sobre o pooler (PgBouncer) do Neon precisa
  // de `pgbouncer=true` (desliga prepared statements) para não quebrar em
  // requisições com várias queries. Também aumentamos o connect_timeout porque
  // o Neon hiberna e demora a acordar no primeiro acesso.
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

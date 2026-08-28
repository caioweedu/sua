#!/usr/bin/env sh
# Resolve a URL do banco a partir das variáveis da Vercel/Neon e roda
# `prisma migrate deploy` com RETRIES.
#
# Motivo: o endpoint DIRETO do Neon (usado pelas migrations) hiberna quando
# ocioso e pode não acordar a tempo na primeira conexão, retornando
# `P1001: Can't reach database server`. Sem retry, isso derruba o build inteiro
# (preview e produção) por um simples cold start. Aqui tentamos algumas vezes,
# com espera crescente, e só falhamos se realmente não conseguir — sem pular
# nenhuma migração (erros reais de migração continuam quebrando o build).

# Resolve DATABASE_URL (pooled) a partir dos nomes possíveis.
if [ -z "$DATABASE_URL" ]; then export DATABASE_URL="$POSTGRES_PRISMA_URL"; fi
if [ -z "$DATABASE_URL" ]; then export DATABASE_URL="$POSTGRES_URL"; fi

# Resolve DIRECT_URL (não-pooled) — usada pelas migrations.
if [ -n "$DATABASE_URL_UNPOOLED" ]; then
  export DIRECT_URL="$DATABASE_URL_UNPOOLED"
elif [ -n "$POSTGRES_URL_NON_POOLING" ]; then
  export DIRECT_URL="$POSTGRES_URL_NON_POOLING"
elif [ -z "$DIRECT_URL" ]; then
  export DIRECT_URL="$DATABASE_URL"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[build] nenhuma URL de banco no ambiente - pulando migrate deploy"
  exit 0
fi

n=1
max=5
until prisma migrate deploy; do
  if [ "$n" -ge "$max" ]; then
    echo "[build] migrate deploy falhou após $max tentativas."
    exit 1
  fi
  sleep_s=$((n * 5))
  echo "[build] migrate deploy falhou (tentativa $n/$max) — aguardando ${sleep_s}s (Neon acordando) e tentando de novo…"
  sleep "$sleep_s"
  n=$((n + 1))
done

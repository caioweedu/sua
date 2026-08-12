-- Inverte o controle de conteúdo compartilhado: a mãe (Weedu) LIBERA vitrines
-- por filha (antes a filha ocultava). Troca a tabela de opt-out por grant.
DROP TABLE IF EXISTS "SharedVitrineOptOut";

CREATE TABLE "SharedVitrineGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vitrineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedVitrineGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SharedVitrineGrant_tenantId_vitrineId_key" ON "SharedVitrineGrant"("tenantId", "vitrineId");
CREATE INDEX "SharedVitrineGrant_tenantId_idx" ON "SharedVitrineGrant"("tenantId");

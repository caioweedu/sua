-- Opt-out de conteúdo herdado da mãe (versão inicial; substituída pela migração
-- 20260811200000, que troca o modelo por liberação controlada pela mãe).
CREATE TABLE "SharedVitrineOptOut" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vitrineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedVitrineOptOut_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SharedVitrineOptOut_tenantId_vitrineId_key" ON "SharedVitrineOptOut"("tenantId", "vitrineId");
CREATE INDEX "SharedVitrineOptOut_tenantId_idx" ON "SharedVitrineOptOut"("tenantId");

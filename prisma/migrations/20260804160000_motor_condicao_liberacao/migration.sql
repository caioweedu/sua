-- Fase 2: motor de condição de liberação (ReleaseCondition).
-- Unifica o gating: substitui ExamPlacement.requireAllLessons e
-- Trilha/Vitrine.prereqTrilhaId por condições genéricas anexadas a cada item.
-- Migração preserva o comportamento existente.

-- 1) Tabela de condições.
CREATE TABLE "ReleaseCondition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetExamPlacementId" TEXT,
    "targetModuloId" TEXT,
    "targetTrilhaId" TEXT,
    "minScore" INTEGER,
    "percent" INTEGER,
    "days" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseCondition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReleaseCondition_tenantId_idx" ON "ReleaseCondition"("tenantId");
ALTER TABLE "ReleaseCondition" ADD CONSTRAINT "ReleaseCondition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Colunas releaseConditionId nos itens que podem ser gated.
ALTER TABLE "Vitrine" ADD COLUMN "releaseConditionId" TEXT;
ALTER TABLE "Trilha" ADD COLUMN "releaseConditionId" TEXT;
ALTER TABLE "Modulo" ADD COLUMN "releaseConditionId" TEXT;
ALTER TABLE "ExamPlacement" ADD COLUMN "releaseConditionId" TEXT;

-- 3) Backfill: ExamPlacement.requireAllLessons -> AFTER_ALL_LESSONS.
--    Id determinístico a partir da colocação para correlacionar.
INSERT INTO "ReleaseCondition" ("id", "tenantId", "type", "createdAt")
SELECT 'rc_pl_' || p."id", ex."tenantId", 'AFTER_ALL_LESSONS', CURRENT_TIMESTAMP
FROM "ExamPlacement" p
JOIN "Exam" ex ON ex."id" = p."examId"
WHERE p."requireAllLessons" = true;

UPDATE "ExamPlacement" p
SET "releaseConditionId" = 'rc_pl_' || p."id"
WHERE p."requireAllLessons" = true;

-- 4) Backfill: Trilha.prereqTrilhaId -> AFTER_TRILHA_COMPLETED.
INSERT INTO "ReleaseCondition" ("id", "tenantId", "type", "targetTrilhaId", "createdAt")
SELECT 'rc_tr_' || t."id", t."tenantId", 'AFTER_TRILHA_COMPLETED', t."prereqTrilhaId", CURRENT_TIMESTAMP
FROM "Trilha" t
WHERE t."prereqTrilhaId" IS NOT NULL;

UPDATE "Trilha" t
SET "releaseConditionId" = 'rc_tr_' || t."id"
WHERE t."prereqTrilhaId" IS NOT NULL;

-- 5) Backfill: Vitrine.prereqTrilhaId -> AFTER_TRILHA_COMPLETED.
INSERT INTO "ReleaseCondition" ("id", "tenantId", "type", "targetTrilhaId", "createdAt")
SELECT 'rc_vt_' || v."id", v."tenantId", 'AFTER_TRILHA_COMPLETED', v."prereqTrilhaId", CURRENT_TIMESTAMP
FROM "Vitrine" v
WHERE v."prereqTrilhaId" IS NOT NULL;

UPDATE "Vitrine" v
SET "releaseConditionId" = 'rc_vt_' || v."id"
WHERE v."prereqTrilhaId" IS NOT NULL;

-- 6) Remove os mecanismos antigos.
ALTER TABLE "ExamPlacement" DROP COLUMN "requireAllLessons";

ALTER TABLE "Trilha" DROP CONSTRAINT "Trilha_prereqTrilhaId_fkey";
DROP INDEX "Trilha_prereqTrilhaId_idx";
ALTER TABLE "Trilha" DROP COLUMN "prereqTrilhaId";

ALTER TABLE "Vitrine" DROP CONSTRAINT "Vitrine_prereqTrilhaId_fkey";
DROP INDEX "Vitrine_prereqTrilhaId_idx";
ALTER TABLE "Vitrine" DROP COLUMN "prereqTrilhaId";

-- 7) Índices e chaves estrangeiras dos novos vínculos.
CREATE INDEX "Vitrine_releaseConditionId_idx" ON "Vitrine"("releaseConditionId");
CREATE INDEX "Trilha_releaseConditionId_idx" ON "Trilha"("releaseConditionId");
CREATE INDEX "Modulo_releaseConditionId_idx" ON "Modulo"("releaseConditionId");
CREATE INDEX "ExamPlacement_releaseConditionId_idx" ON "ExamPlacement"("releaseConditionId");

ALTER TABLE "Vitrine" ADD CONSTRAINT "Vitrine_releaseConditionId_fkey" FOREIGN KEY ("releaseConditionId") REFERENCES "ReleaseCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trilha" ADD CONSTRAINT "Trilha_releaseConditionId_fkey" FOREIGN KEY ("releaseConditionId") REFERENCES "ReleaseCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Modulo" ADD CONSTRAINT "Modulo_releaseConditionId_fkey" FOREIGN KEY ("releaseConditionId") REFERENCES "ReleaseCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamPlacement" ADD CONSTRAINT "ExamPlacement_releaseConditionId_fkey" FOREIGN KEY ("releaseConditionId") REFERENCES "ReleaseCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

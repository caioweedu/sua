-- Fase 4B: regra de liberação composta.
-- A ReleaseCondition deixa de ser uma condição única e passa a ser uma REGRA
-- com N cláusulas (ReleaseClause) combinadas por `logic` (ALL/ANY). Cada
-- condição existente vira uma regra com 1 cláusula (comportamento preservado).

-- 1) Combinação das cláusulas.
ALTER TABLE "ReleaseCondition" ADD COLUMN "logic" TEXT NOT NULL DEFAULT 'ALL';

-- 2) Tabela de cláusulas.
CREATE TABLE "ReleaseClause" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetAulaId" TEXT,
    "targetExamPlacementId" TEXT,
    "targetModuloId" TEXT,
    "targetTrilhaId" TEXT,
    "minScore" INTEGER,
    "percent" INTEGER,
    "days" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReleaseClause_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReleaseClause_conditionId_idx" ON "ReleaseClause"("conditionId");
ALTER TABLE "ReleaseClause" ADD CONSTRAINT "ReleaseClause_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "ReleaseCondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Backfill: cada condição única existente vira uma cláusula da sua regra.
INSERT INTO "ReleaseClause" ("id", "conditionId", "type", "targetExamPlacementId", "targetModuloId", "targetTrilhaId", "minScore", "percent", "days", "order")
SELECT 'rcl_' || c."id", c."id", c."type", c."targetExamPlacementId", c."targetModuloId", c."targetTrilhaId", c."minScore", c."percent", c."days", 0
FROM "ReleaseCondition" c;

-- 4) Remove as colunas antigas da condição (agora vivem nas cláusulas).
ALTER TABLE "ReleaseCondition" DROP COLUMN "type";
ALTER TABLE "ReleaseCondition" DROP COLUMN "targetExamPlacementId";
ALTER TABLE "ReleaseCondition" DROP COLUMN "targetModuloId";
ALTER TABLE "ReleaseCondition" DROP COLUMN "targetTrilhaId";
ALTER TABLE "ReleaseCondition" DROP COLUMN "minScore";
ALTER TABLE "ReleaseCondition" DROP COLUMN "percent";
ALTER TABLE "ReleaseCondition" DROP COLUMN "days";

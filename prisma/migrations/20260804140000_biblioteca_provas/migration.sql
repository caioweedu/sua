-- Fase 1: biblioteca de provas + colocação.
-- Separa a prova (Exam) da trilha (era 1:1) e a torna um item reutilizável da
-- biblioteca do tenant. Cada uso vira uma ExamPlacement num container
-- (vitrine/produto/módulo). Migração preserva os dados existentes.

-- 1) Exam: novas colunas. tenantId entra NULL para permitir o backfill.
ALTER TABLE "Exam" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Exam" ADD COLUMN "tenantId" TEXT;

-- 2) Backfill do tenant da prova a partir da trilha à qual ela estava presa.
UPDATE "Exam" e
SET "tenantId" = t."tenantId"
FROM "Trilha" t
WHERE t."id" = e."trilhaId";

-- 3) ExamAttempt: coluna de colocação (contexto da tentativa).
ALTER TABLE "ExamAttempt" ADD COLUMN "placementId" TEXT;

-- 4) Tabela de colocações.
CREATE TABLE "ExamPlacement" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "vitrineId" TEXT,
    "trilhaId" TEXT,
    "moduloId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "requireAllLessons" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamPlacement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamPlacement_examId_idx" ON "ExamPlacement"("examId");
CREATE INDEX "ExamPlacement_vitrineId_idx" ON "ExamPlacement"("vitrineId");
CREATE INDEX "ExamPlacement_trilhaId_idx" ON "ExamPlacement"("trilhaId");
CREATE INDEX "ExamPlacement_moduloId_idx" ON "ExamPlacement"("moduloId");

-- 5) Backfill: cada prova existente vira uma colocação no seu produto,
--    preservando o gate "só após todas as aulas" (requireAllLessons).
INSERT INTO "ExamPlacement" ("id", "examId", "trilhaId", "order", "required", "requireAllLessons", "createdAt")
SELECT e."id" || '_pl0', e."id", e."trilhaId", 0, true, e."requireAllLessons", CURRENT_TIMESTAMP
FROM "Exam" e
WHERE e."trilhaId" IS NOT NULL;

-- 6) Backfill: tentativas antigas passam a apontar para a colocação criada.
UPDATE "ExamAttempt" a
SET "placementId" = p."id"
FROM "ExamPlacement" p
WHERE p."examId" = a."examId";

-- 7) Remove o vínculo 1:1 antigo do Exam com a trilha.
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_trilhaId_fkey";
DROP INDEX "Exam_trilhaId_key";
ALTER TABLE "Exam" DROP COLUMN "requireAllLessons";
ALTER TABLE "Exam" DROP COLUMN "trilhaId";

-- 8) Agora que está preenchido, torna o tenant obrigatório.
ALTER TABLE "Exam" ALTER COLUMN "tenantId" SET NOT NULL;

-- 9) Índices e chaves estrangeiras novas.
CREATE INDEX "Exam_tenantId_idx" ON "Exam"("tenantId");
CREATE INDEX "ExamAttempt_placementId_idx" ON "ExamAttempt"("placementId");

ALTER TABLE "Exam" ADD CONSTRAINT "Exam_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPlacement" ADD CONSTRAINT "ExamPlacement_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPlacement" ADD CONSTRAINT "ExamPlacement_vitrineId_fkey" FOREIGN KEY ("vitrineId") REFERENCES "Vitrine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPlacement" ADD CONSTRAINT "ExamPlacement_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "Trilha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPlacement" ADD CONSTRAINT "ExamPlacement_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ExamPlacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

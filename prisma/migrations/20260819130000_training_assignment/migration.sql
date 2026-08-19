-- Onda 3 · F3 — Agenda de treinamentos / PDI. Migração ADITIVA.
CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trilhaId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "dueDate" TIMESTAMP(3),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingAssignment_tenantId_idx" ON "TrainingAssignment"("tenantId");
CREATE INDEX "TrainingAssignment_trilhaId_idx" ON "TrainingAssignment"("trilhaId");
CREATE INDEX "TrainingAssignment_userId_idx" ON "TrainingAssignment"("userId");
CREATE INDEX "TrainingAssignment_teamId_idx" ON "TrainingAssignment"("teamId");

ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "Trilha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

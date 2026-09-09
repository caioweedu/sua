-- Treinamentos externos/presenciais (Onda 3 · F3): planejados no sistema, mas
-- executados fora da plataforma; o RH/gestor dá baixa manualmente.

-- TrainingAssignment: tipo + campos de externo; trilhaId passa a ser opcional.
ALTER TABLE "TrainingAssignment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "TrainingAssignment" ADD COLUMN "title" TEXT;
ALTER TABLE "TrainingAssignment" ADD COLUMN "location" TEXT;
ALTER TABLE "TrainingAssignment" ALTER COLUMN "trilhaId" DROP NOT NULL;

-- Baixa manual por participante (base do compliance dos externos).
CREATE TABLE "ExternalCompletion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalCompletion_assignmentId_userId_key" ON "ExternalCompletion"("assignmentId", "userId");
CREATE INDEX "ExternalCompletion_assignmentId_idx" ON "ExternalCompletion"("assignmentId");
CREATE INDEX "ExternalCompletion_userId_idx" ON "ExternalCompletion"("userId");

ALTER TABLE "ExternalCompletion" ADD CONSTRAINT "ExternalCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalCompletion" ADD CONSTRAINT "ExternalCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "requireAllLessons" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Trilha" ADD COLUMN     "prereqTrilhaId" TEXT;

-- AlterTable
ALTER TABLE "Vitrine" ADD COLUMN     "prereqTrilhaId" TEXT;

-- CreateTable
CREATE TABLE "AulaProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AulaProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AulaProgress_userId_idx" ON "AulaProgress"("userId");

-- CreateIndex
CREATE INDEX "AulaProgress_aulaId_idx" ON "AulaProgress"("aulaId");

-- CreateIndex
CREATE UNIQUE INDEX "AulaProgress_userId_aulaId_key" ON "AulaProgress"("userId", "aulaId");

-- CreateIndex
CREATE INDEX "Trilha_prereqTrilhaId_idx" ON "Trilha"("prereqTrilhaId");

-- CreateIndex
CREATE INDEX "Vitrine_prereqTrilhaId_idx" ON "Vitrine"("prereqTrilhaId");

-- AddForeignKey
ALTER TABLE "Vitrine" ADD CONSTRAINT "Vitrine_prereqTrilhaId_fkey" FOREIGN KEY ("prereqTrilhaId") REFERENCES "Trilha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trilha" ADD CONSTRAINT "Trilha_prereqTrilhaId_fkey" FOREIGN KEY ("prereqTrilhaId") REFERENCES "Trilha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaProgress" ADD CONSTRAINT "AulaProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaProgress" ADD CONSTRAINT "AulaProgress_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

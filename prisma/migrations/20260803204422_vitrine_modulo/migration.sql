-- AlterTable
ALTER TABLE "Aula" ADD COLUMN     "moduloId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "bannerUrl" TEXT;

-- AlterTable
ALTER TABLE "Trilha" ADD COLUMN     "vitrineId" TEXT;

-- CreateTable
CREATE TABLE "Vitrine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "bannerUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vitrine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modulo" (
    "id" TEXT NOT NULL,
    "trilhaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Modulo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vitrine_tenantId_idx" ON "Vitrine"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Vitrine_tenantId_slug_key" ON "Vitrine"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Modulo_trilhaId_idx" ON "Modulo"("trilhaId");

-- CreateIndex
CREATE INDEX "Aula_moduloId_idx" ON "Aula"("moduloId");

-- CreateIndex
CREATE INDEX "Trilha_vitrineId_idx" ON "Trilha"("vitrineId");

-- AddForeignKey
ALTER TABLE "Vitrine" ADD CONSTRAINT "Vitrine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trilha" ADD CONSTRAINT "Trilha_vitrineId_fkey" FOREIGN KEY ("vitrineId") REFERENCES "Vitrine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modulo" ADD CONSTRAINT "Modulo_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "Trilha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aula" ADD CONSTRAINT "Aula_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

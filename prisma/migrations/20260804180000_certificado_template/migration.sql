-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "assinatura" TEXT,
ADD COLUMN     "backgroundUrl" TEXT,
ADD COLUMN     "cargaHoraria" TEXT,
ADD COLUMN     "conteudoProgramatico" TEXT,
ADD COLUMN     "professor" TEXT,
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "backgroundUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificatePlacement" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "trilhaId" TEXT NOT NULL,
    "professor" TEXT,
    "cargaHoraria" TEXT,
    "assinatura" TEXT,
    "conteudoProgramatico" TEXT,
    "emissaoUnica" BOOLEAN NOT NULL DEFAULT true,
    "releaseConditionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificatePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificateTemplate_tenantId_idx" ON "CertificateTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "CertificatePlacement_templateId_idx" ON "CertificatePlacement"("templateId");

-- CreateIndex
CREATE INDEX "CertificatePlacement_trilhaId_idx" ON "CertificatePlacement"("trilhaId");

-- CreateIndex
CREATE INDEX "CertificatePlacement_releaseConditionId_idx" ON "CertificatePlacement"("releaseConditionId");

-- CreateIndex
CREATE INDEX "Certificate_templateId_idx" ON "Certificate"("templateId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificatePlacement" ADD CONSTRAINT "CertificatePlacement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificatePlacement" ADD CONSTRAINT "CertificatePlacement_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "Trilha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificatePlacement" ADD CONSTRAINT "CertificatePlacement_releaseConditionId_fkey" FOREIGN KEY ("releaseConditionId") REFERENCES "ReleaseCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;


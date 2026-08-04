-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "showAnswers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shuffleOptions" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessProfileId" TEXT;

-- CreateTable
CREATE TABLE "AccessProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AccessProfileToVitrine" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AccessProfileToVitrine_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "AccessProfile_tenantId_idx" ON "AccessProfile"("tenantId");

-- CreateIndex
CREATE INDEX "_AccessProfileToVitrine_B_index" ON "_AccessProfileToVitrine"("B");

-- AddForeignKey
ALTER TABLE "AccessProfile" ADD CONSTRAINT "AccessProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessProfileId_fkey" FOREIGN KEY ("accessProfileId") REFERENCES "AccessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AccessProfileToVitrine" ADD CONSTRAINT "_AccessProfileToVitrine_A_fkey" FOREIGN KEY ("A") REFERENCES "AccessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AccessProfileToVitrine" ADD CONSTRAINT "_AccessProfileToVitrine_B_fkey" FOREIGN KEY ("B") REFERENCES "Vitrine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

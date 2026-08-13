-- CreateTable
CREATE TABLE "GamificationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GamificationEvent_userId_idx" ON "GamificationEvent"("userId");

-- CreateIndex
CREATE INDEX "GamificationEvent_tenantId_idx" ON "GamificationEvent"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationEvent_userId_type_refId_key" ON "GamificationEvent"("userId", "type", "refId");

-- AddForeignKey
ALTER TABLE "GamificationEvent" ADD CONSTRAINT "GamificationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

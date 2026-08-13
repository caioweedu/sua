-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "gamificationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "rankingEnabled" BOOLEAN NOT NULL DEFAULT true;

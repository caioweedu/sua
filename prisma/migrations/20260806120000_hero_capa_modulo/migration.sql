-- Capa/banner do módulo (aparece no topo do módulo no player).
ALTER TABLE "Modulo" ADD COLUMN "coverUrl" TEXT;

-- Slides do banner rotativo da home (hero).
CREATE TABLE "HeroSlide" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HeroSlide_tenantId_idx" ON "HeroSlide"("tenantId");
ALTER TABLE "HeroSlide" ADD CONSTRAINT "HeroSlide_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

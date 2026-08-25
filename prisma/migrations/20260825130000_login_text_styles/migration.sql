-- Estilo por bloco de texto da tela de login + modo "só imagem" (aditivo).
ALTER TABLE "Tenant" ADD COLUMN "loginEyebrowColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "loginTitleColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "loginSubtitleColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "loginEyebrowBold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "loginTitleBold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "loginSubtitleBold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "loginEyebrowItalic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "loginTitleItalic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "loginSubtitleItalic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "loginHideText" BOOLEAN NOT NULL DEFAULT false;

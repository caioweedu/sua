-- Personalização da tela de login por universidade (aditivo, tudo opcional).
ALTER TABLE "Tenant" ADD COLUMN "loginBgUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "loginEyebrow" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "loginTitle" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "loginSubtitle" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "loginTextColor" TEXT;

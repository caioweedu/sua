-- Entitlement de dois níveis para a gamificação (a mãe libera; a filha liga).
-- Aditivo: nova coluna com default true, para não mudar o comportamento atual.
ALTER TABLE "Tenant" ADD COLUMN "gamificationEntitled" BOOLEAN NOT NULL DEFAULT true;

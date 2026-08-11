-- Telefone do aluno + token de convite/redefinição de senha por link.

-- Campo de telefone (opcional) no usuário.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Token de uso único para o aluno definir/redefinir a senha via link.
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'INVITE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthToken_token_key" ON "AuthToken"("token");
CREATE INDEX "AuthToken_userId_idx" ON "AuthToken"("userId");
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

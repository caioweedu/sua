-- Tema da área do aluno: "dark" (imersivo, estilo streaming) ou "light".
ALTER TABLE "Tenant" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'dark';

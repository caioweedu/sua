-- Flashcards de estudo por produto (deck de revisão do aluno) — Fase 5 fatia 3.
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL,
    "trilhaId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Flashcard_trilhaId_idx" ON "Flashcard"("trilhaId");
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_trilhaId_fkey" FOREIGN KEY ("trilhaId") REFERENCES "Trilha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

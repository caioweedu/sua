-- Onda 3 · F3c — produtos SEM prova final passam a concluir ao terminar todas
-- as aulas. Backfill: fecha as matrículas de quem já concluiu todas as aulas de
-- um produto que NÃO tem prova final e cuja matrícula ainda está IN_PROGRESS.
-- (Não emite certificado retroativo — isso ocorre no fluxo normal a partir daqui.)
UPDATE "Enrollment" e
SET "status" = 'COMPLETED',
    "completedAt" = COALESCE(e."completedAt", NOW())
WHERE e."status" <> 'COMPLETED'
  -- produto sem prova final (nível produto)
  AND NOT EXISTS (
    SELECT 1 FROM "ExamPlacement" ep
    WHERE ep."trilhaId" = e."trilhaId"
      AND ep."moduloId" IS NULL
      AND ep."vitrineId" IS NULL
  )
  -- produto tem aulas
  AND (SELECT COUNT(*) FROM "Aula" a WHERE a."trilhaId" = e."trilhaId") > 0
  -- todas as aulas do produto foram concluídas por esta pessoa
  AND (SELECT COUNT(*) FROM "Aula" a WHERE a."trilhaId" = e."trilhaId")
      = (SELECT COUNT(*) FROM "AulaProgress" ap
           JOIN "Aula" a ON a."id" = ap."aulaId"
          WHERE a."trilhaId" = e."trilhaId" AND ap."userId" = e."userId");

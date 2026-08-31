-- Compliance de treinamentos obrigatórios (aditivo).
-- Validade/recorrência da atribuição (meses após a conclusão; nulo = uma vez só).
ALTER TABLE "TrainingAssignment" ADD COLUMN "recurrenceMonths" INTEGER;
-- Data da conclusão da matrícula (base para calcular a validade).
ALTER TABLE "Enrollment" ADD COLUMN "completedAt" TIMESTAMP(3);

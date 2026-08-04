import "server-only";
import { prisma } from "./db";

// Conjunto de produtos (trilhas) que o aluno já concluiu (matrícula COMPLETED).
export async function completedTrilhaIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.enrollment.findMany({
    where: { userId, status: "COMPLETED" },
    select: { trilhaId: true },
  });
  return new Set(rows.map((r) => r.trilhaId));
}

// Conjunto de aulas concluídas pelo aluno dentro de uma trilha.
export async function completedAulaIds(
  userId: string,
  trilhaId: string
): Promise<Set<string>> {
  const rows = await prisma.aulaProgress.findMany({
    where: { userId, aula: { trilhaId } },
    select: { aulaId: true },
  });
  return new Set(rows.map((r) => r.aulaId));
}

// Retorna o motivo do bloqueio por pré-requisito, ou null se liberado (B2).
export function lockReason(
  prereqId: string | null | undefined,
  prereqTitle: string | null | undefined,
  completed: Set<string>
): string | null {
  if (!prereqId) return null;
  if (completed.has(prereqId)) return null;
  return `Conclua "${prereqTitle ?? "o pré-requisito"}" para liberar.`;
}

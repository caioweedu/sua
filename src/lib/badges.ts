import "server-only";
import { prisma } from "./db";
import { levelFromXp } from "./gamification";

// ---------------------------------------------------------------------------
// Conquistas (badges) — Onda 2, Fatia 2
// ---------------------------------------------------------------------------
// O catálogo vive em código. Cada badge tem uma condição sobre estatísticas
// agregadas do aluno (aulas concluídas, trilhas concluídas, nota máxima, nível).
// Após cada evento relevante, `evaluateBadges` recalcula e concede as que
// passaram a valer — de forma idempotente (unique userId+badgeKey) e não-fatal.

export type BadgeStats = {
  aulas: number;
  trilhas: number;
  notaMaxima: boolean;
  level: number;
};

export type BadgeDef = {
  key: string;
  emoji: string;
  title: string;
  description: string;
  earned: (s: BadgeStats) => boolean;
};

export const BADGES: BadgeDef[] = [
  {
    key: "PRIMEIRA_AULA",
    emoji: "🎬",
    title: "Primeira aula",
    description: "Concluiu sua primeira aula",
    earned: (s) => s.aulas >= 1,
  },
  {
    key: "MARATONA_10",
    emoji: "🏃",
    title: "Maratonista",
    description: "Concluiu 10 aulas",
    earned: (s) => s.aulas >= 10,
  },
  {
    key: "PRIMEIRA_TRILHA",
    emoji: "🎓",
    title: "Primeira trilha",
    description: "Concluiu sua primeira trilha",
    earned: (s) => s.trilhas >= 1,
  },
  {
    key: "CINCO_TRILHAS",
    emoji: "🏆",
    title: "Colecionador",
    description: "Concluiu 5 trilhas",
    earned: (s) => s.trilhas >= 5,
  },
  {
    key: "NOTA_MAXIMA",
    emoji: "💯",
    title: "Gabaritou",
    description: "Tirou 100 em uma prova",
    earned: (s) => s.notaMaxima,
  },
  {
    key: "NIVEL_5",
    emoji: "⭐",
    title: "Nível 5",
    description: "Alcançou o nível 5",
    earned: (s) => s.level >= 5,
  },
];

const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]));

async function computeStats(userId: string): Promise<BadgeStats> {
  const [aulas, trilhas, notaMax, xpAgg] = await Promise.all([
    prisma.aulaProgress.count({ where: { userId } }),
    prisma.enrollment.count({ where: { userId, status: "COMPLETED" } }),
    prisma.examAttempt.findFirst({ where: { userId, score: 100 }, select: { id: true } }),
    prisma.gamificationEvent.aggregate({ where: { userId }, _sum: { points: true } }),
  ]);
  const level = levelFromXp(xpAgg._sum.points ?? 0).level;
  return { aulas, trilhas, notaMaxima: !!notaMax, level };
}

// Recalcula e concede as conquistas recém-desbloqueadas. Idempotente e não-fatal.
export async function evaluateBadges(userId: string, tenantId: string): Promise<void> {
  try {
    const stats = await computeStats(userId);
    const earnedKeys = BADGES.filter((b) => b.earned(stats)).map((b) => b.key);
    if (earnedKeys.length === 0) return;
    await prisma.userBadge.createMany({
      data: earnedKeys.map((badgeKey) => ({ userId, tenantId, badgeKey })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error("[badges] evaluateBadges falhou (ignorado):", err);
  }
}

export type BadgeView = Omit<BadgeDef, "earned"> & { earned: boolean; earnedAt: Date | null };

// Catálogo completo para exibição: cada badge marcado como conquistado ou não.
export async function getBadgeShowcase(userId: string): Promise<BadgeView[]> {
  const owned = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeKey: true, earnedAt: true },
  });
  const ownedMap = new Map(owned.map((b) => [b.badgeKey, b.earnedAt]));
  return BADGES.map((b) => ({
    ...b,
    earned: ownedMap.has(b.key),
    earnedAt: ownedMap.get(b.key) ?? null,
  }));
}

export { BADGE_BY_KEY };

import "server-only";
import { prisma } from "./db";
import { MAX_LEVEL } from "./levelBadges";

// ---------------------------------------------------------------------------
// Gamificação — Onda 2, Fatia 1 (XP + níveis)
// ---------------------------------------------------------------------------

// Entitlement de dois níveis: a gamificação só está ativa quando a MÃE liberou
// (gamificationEntitled) E a filha ligou (gamificationEnabled). O ranking exige,
// além disso, rankingEnabled.
export function gamificationActive(t: {
  gamificationEntitled: boolean;
  gamificationEnabled: boolean;
}): boolean {
  return t.gamificationEntitled && t.gamificationEnabled;
}

export function rankingActive(t: {
  gamificationEntitled: boolean;
  gamificationEnabled: boolean;
  rankingEnabled: boolean;
}): boolean {
  return gamificationActive(t) && t.rankingEnabled;
}

export type GamificationType = "AULA_CONCLUIDA" | "PROVA_APROVADA" | "CERTIFICADO";

// Quantos pontos cada evento concede.
export const XP_POINTS: Record<GamificationType, number> = {
  AULA_CONCLUIDA: 10,
  PROVA_APROVADA: 50,
  CERTIFICADO: 100,
};

// XP acumulado necessário para ESTAR no nível L: 20 * (L-1)^2.
// Curva suave no começo (engaja rápido) e aspiracional no topo:
//   L1=0, L2=20, L3=80, L4=180, L5=320, L10=1620, L15=3920, L20=7220.
function cumulativeXpForLevel(level: number): number {
  return 20 * (level - 1) * (level - 1);
}

export type GamificationStatus = {
  xp: number;
  level: number;
  levelFloor: number; // XP em que o nível atual começou
  nextLevelAt: number; // XP necessário para o próximo nível
  intoLevel: number; // XP já conquistado dentro do nível atual
  levelSpan: number; // XP total entre o nível atual e o próximo
  progressPct: number; // 0-100 do progresso dentro do nível
};

export function levelFromXp(xp: number): GamificationStatus {
  let level = 1;
  while (level < MAX_LEVEL && cumulativeXpForLevel(level + 1) <= xp) level++;

  const atMax = level >= MAX_LEVEL;
  const levelFloor = cumulativeXpForLevel(level);
  const nextLevelAt = atMax ? levelFloor : cumulativeXpForLevel(level + 1);
  const levelSpan = atMax ? 0 : nextLevelAt - levelFloor;
  const intoLevel = xp - levelFloor;
  const progressPct = atMax
    ? 100
    : levelSpan > 0
      ? Math.round((intoLevel / levelSpan) * 100)
      : 0;

  return { xp, level, levelFloor, nextLevelAt, intoLevel, levelSpan, progressPct };
}

// Concede XP de forma IDEMPOTENTE e NÃO-FATAL. A unicidade (userId, type, refId)
// impede pontuar o mesmo recurso duas vezes; qualquer erro é engolido para nunca
// quebrar o fluxo principal do aluno (aula/prova/certificado).
export async function awardXp(
  userId: string,
  tenantId: string,
  type: GamificationType,
  refId: string
): Promise<void> {
  try {
    await prisma.gamificationEvent.createMany({
      data: [{ userId, tenantId, type, points: XP_POINTS[type], refId }],
      skipDuplicates: true,
    });
  } catch (err) {
    // Gamificação é acessória: nunca deve interromper a ação do aluno.
    console.error("[gamification] awardXp falhou (ignorado):", err);
  }
}

// XP + nível do aluno (soma do ledger).
export async function getGamificationStatus(userId: string): Promise<GamificationStatus> {
  const agg = await prisma.gamificationEvent.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return levelFromXp(agg._sum.points ?? 0);
}

// Ofensiva (streak) — Onda 2, Fatia 3. Dias consecutivos com atividade,
// derivados das datas dos eventos de gamificação, no fuso de Brasília. Conta a
// partir de hoje; se ainda não houve atividade hoje mas houve ontem, a sequência
// se mantém (o aluno ainda pode estudar hoje).
const TZ = "America/Sao_Paulo";
function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Ranking (placar) por tenant — Onda 2, Fatia 4. Soma o XP de cada aluno do
// tenant e ordena. Considera apenas alunos (role STUDENT) ativos.
export type RankingRow = { userId: string; name: string; xp: number; rank: number };

export async function getRanking(
  tenantId: string,
  currentUserId: string,
  top = 10
): Promise<{ rows: RankingRow[]; me: RankingRow | null }> {
  const grouped = await prisma.gamificationEvent.groupBy({
    by: ["userId"],
    where: { tenantId },
    _sum: { points: true },
  });

  const students = await prisma.user.findMany({
    where: { tenantId, role: "STUDENT", active: true },
    select: { id: true, name: true },
  });
  const nameById = new Map(students.map((u) => [u.id, u.name]));
  const xpById = new Map(grouped.map((g) => [g.userId, g._sum.points ?? 0]));

  const ranked = students
    .map((u) => ({ userId: u.id, name: u.name, xp: xpById.get(u.id) ?? 0 }))
    .sort((a, b) => b.xp - a.xp)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const rows = ranked.slice(0, top);
  const me = ranked.find((r) => r.userId === currentUserId) ?? null;
  // Garante o nome no me mesmo se ficou de fora do map de alunos por algum motivo.
  if (me && !me.name) me.name = nameById.get(currentUserId) ?? "Você";
  return { rows, me };
}

export async function getStreak(userId: string): Promise<number> {
  const events = await prisma.gamificationEvent.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 730,
  });
  if (events.length === 0) return 0;

  const days = new Set(events.map((e) => dayKey(e.createdAt)));
  let streak = 0;
  for (let i = 0; i < 730; i++) {
    const key = dayKey(new Date(Date.now() - i * 86_400_000));
    if (days.has(key)) {
      streak++;
    } else if (i === 0) {
      // Sem atividade hoje ainda: não quebra — segue contando a partir de ontem.
      continue;
    } else {
      break;
    }
  }
  return streak;
}

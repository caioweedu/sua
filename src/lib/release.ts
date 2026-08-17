import "server-only";
import { prisma } from "./db";
import { levelFromXp } from "./gamification";

// Motor de condição de liberação (Fase 2 + regra composta Fase 4B). Avalia se um
// item (vitrine, produto, módulo, colocação de prova/certificado) está liberado
// para um aluno, com base numa REGRA (várias cláusulas combinadas por ALL/ANY).
// Alvos ausentes/removidos NUNCA travam o aluno.

export const CLAUSE_TYPES = [
  "AFTER_AULA",
  "AFTER_ALL_LESSONS",
  "AFTER_EXAM_PASSED",
  "AFTER_MODULE_COMPLETED",
  "AFTER_TRILHA_COMPLETED",
  "AFTER_PERCENT",
  "AFTER_DAYS",
  "AFTER_LEVEL",
] as const;
export type ClauseType = (typeof CLAUSE_TYPES)[number];

// Uma cláusula (requisito concreto).
export type ClauseData = {
  type: string;
  targetAulaId: string | null;
  targetExamPlacementId: string | null;
  targetModuloId: string | null;
  targetTrilhaId: string | null;
  minScore: number | null;
  percent: number | null;
  days: number | null;
  minLevel: number | null;
};

// Uma regra = combinação (ALL/ANY) de cláusulas.
export type RuleData = { logic: string; clauses: ClauseData[] } | null;

// Contexto do item que carrega a regra (para resolver "todas as aulas do
// container" e "% do curso" quando a cláusula não aponta um alvo explícito).
export type ItemCtx = { moduloId?: string | null; trilhaId?: string | null };

export type UnlockResult = { unlocked: boolean; reason: string | null };
const OK: UnlockResult = { unlocked: true, reason: null };
const lock = (reason: string): UnlockResult => ({ unlocked: false, reason });

// Snapshot do progresso do aluno, montado uma vez por request.
export async function loadProgress(userId: string) {
  const [completedEnroll, passedAttempts, aulaProg, enrolls, xpAgg] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId, status: "COMPLETED" }, select: { trilhaId: true } }),
    prisma.examAttempt.findMany({ where: { userId, passed: true }, select: { placementId: true, score: true } }),
    prisma.aulaProgress.findMany({ where: { userId }, select: { aulaId: true } }),
    prisma.enrollment.findMany({ where: { userId }, select: { trilhaId: true, createdAt: true } }),
    prisma.gamificationEvent.aggregate({ where: { userId }, _sum: { points: true } }),
  ]);
  const passedPlacements = new Set<string>();
  const bestScore = new Map<string, number>();
  for (const a of passedAttempts) {
    if (!a.placementId) continue;
    passedPlacements.add(a.placementId);
    bestScore.set(a.placementId, Math.max(bestScore.get(a.placementId) ?? 0, a.score));
  }
  return {
    completedTrilhas: new Set(completedEnroll.map((e) => e.trilhaId)),
    passedPlacements,
    bestScore,
    doneAulas: new Set(aulaProg.map((a) => a.aulaId)),
    enrolledAt: new Map(enrolls.map((e) => [e.trilhaId, e.createdAt])),
    level: levelFromXp(xpAgg._sum.points ?? 0).level,
  };
}
export type Progress = Awaited<ReturnType<typeof loadProgress>>;

// Avalia uma cláusula isolada.
async function evalClause(c: ClauseData, ctx: ItemCtx, prog: Progress): Promise<UnlockResult> {
  switch (c.type) {
    case "AFTER_AULA": {
      if (!c.targetAulaId) return OK; // alvo removido → não trava
      return prog.doneAulas.has(c.targetAulaId)
        ? OK
        : lock("Conclua a aula indicada para liberar.");
    }

    case "AFTER_ALL_LESSONS": {
      const where = c.targetModuloId
        ? { moduloId: c.targetModuloId }
        : c.targetTrilhaId
        ? { trilhaId: c.targetTrilhaId }
        : ctx.moduloId
        ? { moduloId: ctx.moduloId }
        : ctx.trilhaId
        ? { trilhaId: ctx.trilhaId }
        : null;
      if (!where) return OK;
      const aulas = await prisma.aula.findMany({ where, select: { id: true } });
      if (aulas.length === 0) return OK;
      return aulas.every((a) => prog.doneAulas.has(a.id))
        ? OK
        : lock("Conclua todas as aulas para liberar.");
    }

    case "AFTER_EXAM_PASSED": {
      const pid = c.targetExamPlacementId;
      if (!pid) return OK;
      if (!prog.passedPlacements.has(pid))
        return lock("Seja aprovado na prova indicada para liberar.");
      if (c.minScore != null && (prog.bestScore.get(pid) ?? 0) < c.minScore)
        return lock(`Atinja ${c.minScore}% na prova indicada para liberar.`);
      return OK;
    }

    case "AFTER_MODULE_COMPLETED": {
      const mid = c.targetModuloId;
      if (!mid) return OK;
      const mod = await prisma.modulo.findUnique({
        where: { id: mid },
        select: { aulas: { select: { id: true } }, examPlacements: { select: { id: true } } },
      });
      if (!mod) return OK;
      const aulasDone = mod.aulas.every((a) => prog.doneAulas.has(a.id));
      const provasDone = mod.examPlacements.every((p) => prog.passedPlacements.has(p.id));
      return aulasDone && provasDone
        ? OK
        : lock("Conclua o módulo indicado para liberar.");
    }

    case "AFTER_TRILHA_COMPLETED": {
      const tid = c.targetTrilhaId;
      if (!tid) return OK;
      return prog.completedTrilhas.has(tid)
        ? OK
        : lock("Conclua o produto pré-requisito para liberar.");
    }

    case "AFTER_PERCENT": {
      const tid = c.targetTrilhaId ?? ctx.trilhaId ?? null;
      const pct = c.percent ?? 0;
      if (!tid) return OK;
      const aulas = await prisma.aula.findMany({ where: { trilhaId: tid }, select: { id: true } });
      if (aulas.length === 0) return OK;
      const done = aulas.filter((a) => prog.doneAulas.has(a.id)).length;
      const cur = Math.round((done / aulas.length) * 100);
      return cur >= pct ? OK : lock(`Conclua ${pct}% do produto para liberar (você está em ${cur}%).`);
    }

    case "AFTER_DAYS": {
      const tid = c.targetTrilhaId ?? ctx.trilhaId ?? null;
      const days = c.days ?? 0;
      const at = tid ? prog.enrolledAt.get(tid) : null;
      if (!at) return lock(`Disponível ${days} dia(s) após a matrícula.`);
      const elapsed = (Date.now() - at.getTime()) / 86_400_000;
      return elapsed >= days ? OK : lock(`Disponível em ${Math.ceil(days - elapsed)} dia(s).`);
    }

    case "AFTER_LEVEL": {
      const min = c.minLevel ?? 0;
      if (min <= 1) return OK; // nível 1 é o inicial → nunca trava
      return prog.level >= min
        ? OK
        : lock(`Alcance o nível ${min} para liberar (você está no nível ${prog.level}).`);
    }

    default:
      return OK;
  }
}

// Avalia a regra (combinação de cláusulas). Sem regra/cláusulas = liberado.
export async function isUnlocked(
  rule: RuleData,
  ctx: ItemCtx,
  prog: Progress
): Promise<UnlockResult> {
  if (!rule || !rule.clauses || rule.clauses.length === 0) return OK;

  const results = await Promise.all(rule.clauses.map((c) => evalClause(c, ctx, prog)));

  if (rule.logic === "ANY") {
    if (results.some((r) => r.unlocked)) return OK;
    const reasons = results.map((r) => r.reason).filter(Boolean);
    return lock(
      reasons.length ? `Cumpra ao menos um requisito: ${reasons.join(" ou ")}` : "Requisitos não cumpridos."
    );
  }
  // ALL
  const failing = results.find((r) => !r.unlocked);
  return failing ?? OK;
}

// --- Descrição para o admin --------------------------------------------
function describeClause(c: ClauseData): string {
  switch (c.type) {
    case "AFTER_AULA":
      return "concluir uma aula";
    case "AFTER_ALL_LESSONS":
      return "concluir todas as aulas";
    case "AFTER_EXAM_PASSED":
      return `aprovação numa prova${c.minScore != null ? ` (mín. ${c.minScore}%)` : ""}`;
    case "AFTER_MODULE_COMPLETED":
      return "concluir um módulo";
    case "AFTER_TRILHA_COMPLETED":
      return "concluir um produto";
    case "AFTER_PERCENT":
      return `${c.percent ?? 0}% do produto`;
    case "AFTER_DAYS":
      return `${c.days ?? 0} dia(s) após a matrícula`;
    case "AFTER_LEVEL":
      return `alcançar o nível ${c.minLevel ?? 0}`;
    default:
      return "requisito";
  }
}

export function describeCondition(rule: RuleData): string {
  if (!rule || !rule.clauses || rule.clauses.length === 0) return "Sempre liberado";
  const parts = rule.clauses.map(describeClause);
  if (parts.length === 1) return `Após ${parts[0]}`;
  const join = rule.logic === "ANY" ? " OU " : " E ";
  return `${rule.logic === "ANY" ? "Qualquer" : "Todas"}: ${parts.join(join)}`;
}

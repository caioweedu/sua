import "server-only";
import { prisma } from "./db";

// Motor de condição de liberação (Fase 2). Avalia se um item (vitrine, produto,
// módulo ou colocação de prova) está liberado para um aluno, com base numa
// ReleaseCondition anexada. Alvos ausentes/removidos NUNCA travam o aluno.

export const CONDITION_TYPES = [
  "AFTER_ALL_LESSONS",
  "AFTER_EXAM_PASSED",
  "AFTER_MODULE_COMPLETED",
  "AFTER_TRILHA_COMPLETED",
  "AFTER_PERCENT",
  "AFTER_DAYS",
] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

// Subconjunto estrutural de ReleaseCondition usado pelo motor.
export type ConditionData = {
  type: string;
  targetExamPlacementId: string | null;
  targetModuloId: string | null;
  targetTrilhaId: string | null;
  minScore: number | null;
  percent: number | null;
  days: number | null;
} | null;

// Contexto do item que carrega a condição (para resolver "todas as aulas do
// container" e "% do curso" quando a condição não aponta um alvo explícito).
export type ItemCtx = { moduloId?: string | null; trilhaId?: string | null };

export type UnlockResult = { unlocked: boolean; reason: string | null };
const OK: UnlockResult = { unlocked: true, reason: null };
const lock = (reason: string): UnlockResult => ({ unlocked: false, reason });

// Snapshot do progresso do aluno, montado uma vez por request.
export async function loadProgress(userId: string) {
  const [completedEnroll, passedAttempts, aulaProg, enrolls] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId, status: "COMPLETED" }, select: { trilhaId: true } }),
    prisma.examAttempt.findMany({ where: { userId, passed: true }, select: { placementId: true, score: true } }),
    prisma.aulaProgress.findMany({ where: { userId }, select: { aulaId: true } }),
    prisma.enrollment.findMany({ where: { userId }, select: { trilhaId: true, createdAt: true } }),
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
  };
}
export type Progress = Awaited<ReturnType<typeof loadProgress>>;

// Avalia uma condição. Sem condição = liberado.
export async function isUnlocked(
  cond: ConditionData,
  ctx: ItemCtx,
  prog: Progress
): Promise<UnlockResult> {
  if (!cond) return OK;

  switch (cond.type) {
    case "AFTER_ALL_LESSONS": {
      const where = cond.targetModuloId
        ? { moduloId: cond.targetModuloId }
        : cond.targetTrilhaId
        ? { trilhaId: cond.targetTrilhaId }
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
      const pid = cond.targetExamPlacementId;
      if (!pid) return OK; // alvo removido → não trava
      if (!prog.passedPlacements.has(pid))
        return lock("Seja aprovado na prova indicada para liberar.");
      if (cond.minScore != null && (prog.bestScore.get(pid) ?? 0) < cond.minScore)
        return lock(`Atinja ${cond.minScore}% na prova indicada para liberar.`);
      return OK;
    }

    case "AFTER_MODULE_COMPLETED": {
      const mid = cond.targetModuloId;
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
      const tid = cond.targetTrilhaId;
      if (!tid) return OK;
      return prog.completedTrilhas.has(tid)
        ? OK
        : lock("Conclua o produto pré-requisito para liberar.");
    }

    case "AFTER_PERCENT": {
      const tid = cond.targetTrilhaId ?? ctx.trilhaId ?? null;
      const pct = cond.percent ?? 0;
      if (!tid) return OK;
      const aulas = await prisma.aula.findMany({ where: { trilhaId: tid }, select: { id: true } });
      if (aulas.length === 0) return OK;
      const done = aulas.filter((a) => prog.doneAulas.has(a.id)).length;
      const cur = Math.round((done / aulas.length) * 100);
      return cur >= pct ? OK : lock(`Conclua ${pct}% do produto para liberar (você está em ${cur}%).`);
    }

    case "AFTER_DAYS": {
      const tid = cond.targetTrilhaId ?? ctx.trilhaId ?? null;
      const days = cond.days ?? 0;
      const at = tid ? prog.enrolledAt.get(tid) : null;
      if (!at) return lock(`Disponível ${days} dia(s) após a matrícula.`);
      const elapsed = (Date.now() - at.getTime()) / 86_400_000;
      return elapsed >= days
        ? OK
        : lock(`Disponível em ${Math.ceil(days - elapsed)} dia(s).`);
    }

    default:
      return OK;
  }
}

// Rótulos amigáveis para o admin. `labels` traz os nomes já resolvidos dos
// alvos (prova/módulo/produto), quando existirem.
export function describeCondition(
  cond: ConditionData,
  labels: { exam?: string; modulo?: string; trilha?: string } = {}
): string {
  if (!cond) return "Sempre liberado";
  switch (cond.type) {
    case "AFTER_ALL_LESSONS":
      return "Após concluir todas as aulas";
    case "AFTER_EXAM_PASSED":
      return `Após ser aprovado na prova${labels.exam ? ` "${labels.exam}"` : ""}${
        cond.minScore != null ? ` (mín. ${cond.minScore}%)` : ""
      }`;
    case "AFTER_MODULE_COMPLETED":
      return `Após concluir o módulo${labels.modulo ? ` "${labels.modulo}"` : ""}`;
    case "AFTER_TRILHA_COMPLETED":
      return `Após concluir o produto${labels.trilha ? ` "${labels.trilha}"` : ""}`;
    case "AFTER_PERCENT":
      return `Após concluir ${cond.percent ?? 0}% do produto`;
    case "AFTER_DAYS":
      return `${cond.days ?? 0} dia(s) após a matrícula`;
    default:
      return "Condição";
  }
}

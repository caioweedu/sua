import "server-only";
import { prisma } from "./db";

// Onda 3 · F3 — Compliance de treinamentos obrigatórios. Para cada pessoa,
// cruza os treinamentos OBRIGATÓRIOS atribuídos (diretos + herdados da equipe)
// com o que foi concluído e a validade/recorrência, classificando cada item em:
//   em_dia   — concluído e (sem recorrência) ou (dentro da validade)
//   a_vencer — recorrente, ainda válido, mas vence em até WARN_DAYS dias
//   vencido  — recorrente cuja validade já passou (precisa refazer)
//   pendente — obrigatório ainda não concluído
//   sem_data — recorrente concluído, mas sem data de conclusão registrada
//              (dado legado; não dá para calcular a validade)
// Cobre treinamentos ONLINE (trilha da plataforma; conclusão via matrícula/
// certificado) e EXTERNAL (presencial/outra plataforma; conclusão = baixa
// manual do RH). Batch (poucas consultas), escopado ao tenant.

export type ComplianceStatus = "em_dia" | "a_vencer" | "vencido" | "pendente" | "sem_data";

// Janela de aviso: um item recorrente que vence dentro deste prazo já entra como
// "a vencer" para o gestor agir antes de virar não-conformidade.
export const WARN_DAYS = 30;

export type ComplianceRow = {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
  total: number; // treinamentos obrigatórios atribuídos
  emDia: number;
  aVencer: number;
  vencido: number;
  pendente: number;
  semData: number;
  conforme: boolean; // sem vencidos e sem pendentes
};

// Um item de compliance por pessoa+treinamento obrigatório, com título e a
// DATA-ALVO (vencimento do recorrente, ou prazo do pendente).
export type ComplianceItem = {
  userId: string;
  userName: string;
  userEmail: string;
  teamId: string | null;
  refKey: string; // id estável do item (produto ou atribuição externa)
  title: string;
  status: ComplianceStatus;
  targetDate: Date | null; // vencimento (recorrente) ou prazo (pendente)
};

function addMonths(d: Date, m: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

type ResolvedItem = { refKey: string; title: string; status: ComplianceStatus; targetDate: Date | null };
type StudentLite = { id: string; name: string; email: string; teamId: string | null };

// Núcleo compartilhado: resolve, por aluno, os obrigatórios (online + externo)
// já classificados. As duas funções públicas abaixo só agregam/mapeiam.
async function resolveCompliance(
  tenantId: string,
  contentIds: string[],
  opts: { activeOnly: boolean }
): Promise<{ student: StudentLite; items: ResolvedItem[] }[]> {
  const [students, assignments, completed, certs, extDoneRows] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "STUDENT", ...(opts.activeOnly ? { active: true } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, teamId: true },
    }),
    // Obrigatórios: online (trilha publicada no escopo) + externo (sem trilha).
    prisma.trainingAssignment.findMany({
      where: {
        tenantId,
        required: true,
        OR: [
          { kind: { not: "EXTERNAL" }, trilha: { published: true, tenantId: { in: contentIds } } },
          { kind: "EXTERNAL" },
        ],
      },
      select: {
        id: true,
        kind: true,
        trilhaId: true,
        userId: true,
        teamId: true,
        dueDate: true,
        recurrenceMonths: true,
        title: true,
        trilha: { select: { title: true } },
      },
    }),
    prisma.enrollment.findMany({
      where: { status: "COMPLETED", user: { tenantId } },
      select: { userId: true, trilhaId: true, completedAt: true },
    }),
    prisma.certificate.findMany({
      where: { user: { tenantId } },
      select: { userId: true, trilhaId: true, issuedAt: true },
    }),
    prisma.externalCompletion.findMany({
      where: { assignment: { tenantId } },
      select: { assignmentId: true, userId: true, completedAt: true },
    }),
  ]);

  // Conclusão dos ONLINE por pessoa+produto: matrícula concluída (renovada a
  // cada aprovação) com fallback legado para a emissão do certificado.
  const doneAt = new Map<string, Date | null>();
  for (const e of completed) doneAt.set(`${e.userId}:${e.trilhaId}`, e.completedAt ?? null);
  for (const c of certs) {
    const key = `${c.userId}:${c.trilhaId}`;
    if (!doneAt.has(key) || doneAt.get(key) == null) doneAt.set(key, c.issuedAt);
  }
  const onlineDone = new Set([
    ...completed.map((e) => `${e.userId}:${e.trilhaId}`),
    ...certs.map((c) => `${c.userId}:${c.trilhaId}`),
  ]);

  // Conclusão dos EXTERNAL por pessoa+atribuição (baixa manual).
  const extDoneAt = new Map<string, Date | null>();
  const extDone = new Set<string>();
  for (const e of extDoneRows) {
    extDoneAt.set(`${e.userId}:${e.assignmentId}`, e.completedAt ?? null);
    extDone.add(`${e.userId}:${e.assignmentId}`);
  }

  type Assign = (typeof assignments)[number];
  const byUser = new Map<string, Assign[]>();
  const byTeam = new Map<string, Assign[]>();
  for (const a of assignments) {
    if (a.userId) {
      if (!byUser.has(a.userId)) byUser.set(a.userId, []);
      byUser.get(a.userId)!.push(a);
    } else if (a.teamId) {
      if (!byTeam.has(a.teamId)) byTeam.set(a.teamId, []);
      byTeam.get(a.teamId)!.push(a);
    }
  }

  const now = new Date();
  const warnLimit = new Date(now.getTime() + WARN_DAYS * 24 * 60 * 60 * 1000);

  const classify = (completedItem: boolean, rec: number | null, at: Date | null, due: Date | null): { status: ComplianceStatus; targetDate: Date | null } => {
    if (!completedItem) return { status: "pendente", targetDate: due };
    if (!rec || rec <= 0) return { status: "em_dia", targetDate: null };
    if (!at) return { status: "sem_data", targetDate: null };
    const expiry = addMonths(at, rec);
    const status: ComplianceStatus = expiry < now ? "vencido" : expiry < warnLimit ? "a_vencer" : "em_dia";
    return { status, targetDate: expiry };
  };

  return students.map((s) => {
    // Merge: online deduplica por produto (direto + equipe → recorrência mais
    // curta e menor prazo); externo é uma linha por atribuição.
    const merged = new Map<string, { rec: number | null; due: Date | null; title: string; external: boolean; assignmentId: string; trilhaId: string | null }>();
    const consider = [...(byUser.get(s.id) ?? []), ...(s.teamId ? byTeam.get(s.teamId) ?? [] : [])];
    for (const a of consider) {
      const external = a.kind === "EXTERNAL";
      const refKey = external ? `x:${a.id}` : `t:${a.trilhaId}`;
      const title = external ? a.title ?? "Treinamento externo" : a.trilha?.title ?? "Treinamento";
      const prev = merged.get(refKey);
      if (!prev) {
        merged.set(refKey, { rec: a.recurrenceMonths ?? null, due: a.dueDate ?? null, title, external, assignmentId: a.id, trilhaId: a.trilhaId ?? null });
      } else {
        const rec =
          prev.rec != null && a.recurrenceMonths != null
            ? Math.min(prev.rec, a.recurrenceMonths)
            : prev.rec ?? a.recurrenceMonths ?? null;
        const due =
          prev.due && a.dueDate ? (a.dueDate < prev.due ? a.dueDate : prev.due) : prev.due ?? a.dueDate ?? null;
        merged.set(refKey, { ...prev, rec, due });
      }
    }

    const items: ResolvedItem[] = [];
    for (const [refKey, m] of merged) {
      const compKey = m.external ? `${s.id}:${m.assignmentId}` : `${s.id}:${m.trilhaId}`;
      const isDone = m.external ? extDone.has(compKey) : onlineDone.has(compKey);
      const at = m.external ? extDoneAt.get(compKey) ?? null : doneAt.get(compKey) ?? null;
      const { status, targetDate } = classify(isDone, m.rec, at, m.due);
      items.push({ refKey, title: m.title, status, targetDate });
    }
    return { student: s, items };
  });
}

export async function loadComplianceOverview(
  tenantId: string,
  contentIds: string[]
): Promise<ComplianceRow[]> {
  const resolved = await resolveCompliance(tenantId, contentIds, { activeOnly: false });
  return resolved
    .map(({ student: s, items }) => {
      let emDia = 0, aVencer = 0, vencido = 0, pendente = 0, semData = 0;
      for (const it of items) {
        if (it.status === "em_dia") emDia++;
        else if (it.status === "a_vencer") aVencer++;
        else if (it.status === "vencido") vencido++;
        else if (it.status === "pendente") pendente++;
        else semData++;
      }
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        teamId: s.teamId,
        total: items.length,
        emDia,
        aVencer,
        vencido,
        pendente,
        semData,
        conforme: vencido === 0 && pendente === 0,
      };
    })
    .sort(
      (a, b) =>
        b.vencido - a.vencido ||
        b.pendente - a.pendente ||
        b.aVencer - a.aVencer ||
        a.name.localeCompare(b.name)
    );
}

export async function loadComplianceItems(
  tenantId: string,
  contentIds: string[]
): Promise<ComplianceItem[]> {
  const resolved = await resolveCompliance(tenantId, contentIds, { activeOnly: true });
  const out: ComplianceItem[] = [];
  for (const { student: s, items } of resolved) {
    for (const it of items) {
      out.push({
        userId: s.id,
        userName: s.name,
        userEmail: s.email,
        teamId: s.teamId,
        refKey: it.refKey,
        title: it.title,
        status: it.status,
        targetDate: it.targetDate,
      });
    }
  }
  return out;
}

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
// Batch (poucas consultas), escopado ao tenant.

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

function addMonths(d: Date, m: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

export async function loadComplianceOverview(
  tenantId: string,
  contentIds: string[]
): Promise<ComplianceRow[]> {
  const [students, assignments, completed, certs] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "STUDENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, teamId: true },
    }),
    // Só obrigatórios, de produtos publicados dentro do escopo de conteúdo.
    prisma.trainingAssignment.findMany({
      where: { tenantId, required: true, trilha: { published: true, tenantId: { in: contentIds } } },
      select: { trilhaId: true, userId: true, teamId: true, dueDate: true, recurrenceMonths: true },
    }),
    prisma.enrollment.findMany({
      where: { status: "COMPLETED", user: { tenantId } },
      select: { userId: true, trilhaId: true, completedAt: true },
    }),
    prisma.certificate.findMany({
      where: { user: { tenantId } },
      select: { userId: true, trilhaId: true, issuedAt: true },
    }),
  ]);

  // Data de conclusão por pessoa+produto: a matrícula concluída é a fonte
  // (renovada a cada aprovação); o certificado mais recente é o fallback legado.
  const doneAt = new Map<string, Date | null>();
  for (const e of completed) {
    doneAt.set(`${e.userId}:${e.trilhaId}`, e.completedAt ?? null);
  }
  for (const c of certs) {
    const key = `${c.userId}:${c.trilhaId}`;
    if (!doneAt.has(key)) {
      doneAt.set(key, c.issuedAt);
    } else if (doneAt.get(key) == null) {
      // matrícula concluída sem data → usa a emissão do certificado.
      doneAt.set(key, c.issuedAt);
    }
  }
  const completedSet = new Set([
    ...completed.map((e) => `${e.userId}:${e.trilhaId}`),
    ...certs.map((c) => `${c.userId}:${c.trilhaId}`),
  ]);

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

  return students
    .map((s) => {
      // Obrigatórios da pessoa: diretos + da equipe, um por produto. Se o mesmo
      // produto vem de mais de uma origem, mantém a recorrência mais curta
      // (mais rígida) e o menor prazo.
      const merged = new Map<string, { rec: number | null; due: Date | null }>();
      const consider = [
        ...(byUser.get(s.id) ?? []),
        ...(s.teamId ? byTeam.get(s.teamId) ?? [] : []),
      ];
      for (const a of consider) {
        const prev = merged.get(a.trilhaId);
        if (!prev) {
          merged.set(a.trilhaId, { rec: a.recurrenceMonths ?? null, due: a.dueDate ?? null });
        } else {
          const rec =
            prev.rec != null && a.recurrenceMonths != null
              ? Math.min(prev.rec, a.recurrenceMonths)
              : prev.rec ?? a.recurrenceMonths ?? null;
          const due =
            prev.due && a.dueDate ? (a.dueDate < prev.due ? a.dueDate : prev.due) : prev.due ?? a.dueDate ?? null;
          merged.set(a.trilhaId, { rec, due });
        }
      }

      let emDia = 0, aVencer = 0, vencido = 0, pendente = 0, semData = 0;
      for (const [trilhaId, m] of merged) {
        const key = `${s.id}:${trilhaId}`;
        if (!completedSet.has(key)) {
          pendente++;
          continue;
        }
        // Concluído. Sem recorrência = em dia para sempre.
        if (!m.rec || m.rec <= 0) {
          emDia++;
          continue;
        }
        // Recorrente: precisa da data de conclusão para calcular a validade.
        const at = doneAt.get(key) ?? null;
        if (!at) {
          semData++;
          continue;
        }
        const expiry = addMonths(at, m.rec);
        if (expiry < now) vencido++;
        else if (expiry < warnLimit) aVencer++;
        else emDia++;
      }

      const total = merged.size;
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        teamId: s.teamId,
        total,
        emDia,
        aVencer,
        vencido,
        pendente,
        semData,
        conforme: vencido === 0 && pendente === 0,
      };
    })
    // Piores primeiro: vencidos, depois pendentes, depois a vencer.
    .sort(
      (a, b) =>
        b.vencido - a.vencido ||
        b.pendente - a.pendente ||
        b.aVencer - a.aVencer ||
        a.name.localeCompare(b.name)
    );
}

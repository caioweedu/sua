import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "./db";
import { issueCertificateForPlacement } from "./certificate";
import { awardXp } from "./gamification";
import { evaluateBadges } from "./badges";

// Onda 3 · F3c — conclusão de produto SEM prova final.
// Produtos COM prova final continuam sendo fechados pela aprovação na prova
// (ver actions/exam.ts). Produtos SEM prova final passam a fechar quando o
// aluno conclui TODAS as aulas — assim todo produto pode ser finalizado, com
// ou sem prova, e a matrícula (fonte da verdade de "concluído") reflete isso.
// Idempotente: não faz nada se já estiver concluído.
function newCode(): string {
  return randomUUID().split("-")[0].toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
}

export async function finalizeTrilhaByAulas(
  userId: string,
  tenantId: string,
  userName: string,
  trilhaId: string
): Promise<void> {
  const trilha = await prisma.trilha.findFirst({
    where: { id: trilhaId, tenantId },
    select: {
      id: true,
      title: true,
      aulas: { select: { id: true } },
      // Prova final do produto (nível produto). Se existir, quem fecha é a prova.
      examPlacements: {
        where: { moduloId: null, vitrineId: null },
        select: { id: true },
      },
    },
  });
  if (!trilha) return;
  if (trilha.examPlacements.length > 0) return; // tem prova final: a prova é o gate
  const total = trilha.aulas.length;
  if (total === 0) return; // produto sem aulas: nada a concluir

  // Já concluído? evita reemitir/renovar validade à toa.
  const enr = await prisma.enrollment.findUnique({
    where: { userId_trilhaId: { userId, trilhaId } },
    select: { status: true },
  });
  if (enr?.status === "COMPLETED") return;

  // Todas as aulas do produto feitas?
  const doneCount = await prisma.aulaProgress.count({
    where: { userId, aula: { trilhaId } },
  });
  if (doneCount < total) return;

  // Fecha a matrícula (completedAt = agora: base da validade/recorrência).
  await prisma.enrollment.upsert({
    where: { userId_trilhaId: { userId, trilhaId } },
    update: { status: "COMPLETED", completedAt: new Date() },
    create: { userId, trilhaId, status: "COMPLETED", completedAt: new Date() },
  });

  // Certificado: mesma lógica da prova — por colocação (respeita condição),
  // senão o certificado padrão (legado).
  let issued = false;
  const existingCert = await prisma.certificate.findFirst({ where: { userId, trilhaId } });
  if (existingCert) {
    issued = true;
  } else {
    const certPlacement = await prisma.certificatePlacement.findFirst({
      where: { trilhaId },
      select: { id: true },
    });
    if (certPlacement) {
      const res = await issueCertificateForPlacement(userId, certPlacement.id);
      if ("code" in res) issued = true;
    } else {
      await prisma.certificate.create({
        data: { code: newCode(), userId, trilhaId, studentName: userName, trilhaTitle: trilha.title },
      });
      issued = true;
    }
  }

  if (issued) await awardXp(userId, tenantId, "CERTIFICADO", trilhaId);
  await evaluateBadges(userId, tenantId);
}

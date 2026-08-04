"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Matricula o aluno na trilha (idempotente).
export async function enroll(trilhaId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.enrollment.upsert({
    where: { userId_trilhaId: { userId: user.id, trilhaId } },
    update: {},
    create: { userId: user.id, trilhaId, status: "IN_PROGRESS" },
  });
  revalidatePath(`/trilhas/${trilhaId}`);
}

// Marca/desmarca a conclusão de uma aula pelo aluno. Garante a matrícula e
// serve de base para o progresso da trilha e a liberação da prova (B2).
export async function toggleAulaComplete(
  aulaId: string,
  trilhaId: string,
  done: boolean
) {
  const user = await getCurrentUser();
  if (!user) return;

  // Confirma que a aula pertence à trilha do tenant do aluno (evita abuso).
  const aula = await prisma.aula.findFirst({
    where: { id: aulaId, trilhaId, trilha: { tenantId: user.tenantId } },
    select: { id: true },
  });
  if (!aula) return;

  if (done) {
    await prisma.enrollment.upsert({
      where: { userId_trilhaId: { userId: user.id, trilhaId } },
      update: {},
      create: { userId: user.id, trilhaId, status: "IN_PROGRESS" },
    });
    await prisma.aulaProgress.upsert({
      where: { userId_aulaId: { userId: user.id, aulaId } },
      update: {},
      create: { userId: user.id, aulaId },
    });
  } else {
    await prisma.aulaProgress.deleteMany({ where: { userId: user.id, aulaId } });
  }
  revalidatePath(`/trilhas/${trilhaId}`);
}

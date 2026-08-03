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

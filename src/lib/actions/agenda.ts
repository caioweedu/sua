"use server";

// Onda 3 · F3 — Agenda de treinamentos (PDI). Atribuir/remover treinamentos a
// uma pessoa ou equipe, com prazo. Guardado por requireAdmin e escopado ao
// tenant (o alvo e o produto precisam pertencer ao tenant/escopo de conteúdo).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { contentTenantIds } from "@/lib/access";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) throw new Error("Sem permissão.");
  return user;
}

export async function assignTraining(formData: FormData) {
  const admin = await requireAdmin();
  const trilhaId = String(formData.get("trilhaId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim() || null;
  const teamId = String(formData.get("teamId") ?? "").trim() || null;
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const required = formData.get("required") != null;
  // Exatamente um alvo, e um produto válido.
  if (!trilhaId || (!userId && !teamId) || (userId && teamId)) return;

  const trilha = await prisma.trilha.findFirst({
    where: { id: trilhaId, tenantId: { in: contentTenantIds(admin.tenant) } },
    select: { id: true },
  });
  if (!trilha) return;

  if (userId) {
    const u = await prisma.user.findFirst({
      where: { id: userId, tenantId: admin.tenantId },
      select: { id: true },
    });
    if (!u) return;
  }
  if (teamId) {
    const t = await prisma.team.findFirst({
      where: { id: teamId, tenantId: admin.tenantId },
      select: { id: true },
    });
    if (!t) return;
  }

  const dueDate = dueRaw ? new Date(dueRaw) : null;

  // Não duplica a mesma atribuição (produto + alvo): atualiza prazo/obrigatório.
  const existing = await prisma.trainingAssignment.findFirst({
    where: { tenantId: admin.tenantId, trilhaId, userId, teamId },
    select: { id: true },
  });
  if (existing) {
    await prisma.trainingAssignment.update({ where: { id: existing.id }, data: { dueDate, required } });
  } else {
    await prisma.trainingAssignment.create({
      data: { tenantId: admin.tenantId, trilhaId, userId, teamId, dueDate, required, createdById: admin.id },
    });
  }

  revalidatePath("/admin");
  if (userId) revalidatePath(`/admin/alunos/${userId}`);
  revalidatePath("/dashboard");
}

export async function removeAssignment(id: string) {
  const admin = await requireAdmin();
  const a = await prisma.trainingAssignment.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: { id: true, userId: true },
  });
  if (!a) return;
  await prisma.trainingAssignment.delete({ where: { id } });
  revalidatePath("/admin");
  if (a.userId) revalidatePath(`/admin/alunos/${a.userId}`);
  revalidatePath("/dashboard");
}

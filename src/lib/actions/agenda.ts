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
  const userId = String(formData.get("userId") ?? "").trim() || null;
  const teamId = String(formData.get("teamId") ?? "").trim() || null;
  const startRaw = String(formData.get("startDate") ?? "").trim();
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const required = formData.get("required") != null;

  // Produtos: um ou vários (checkboxes por vitrine) — aceita também o campo
  // único legado `trilhaId`.
  const ids = [
    ...formData.getAll("trilhaIds").map((v) => String(v).trim()),
    String(formData.get("trilhaId") ?? "").trim(),
  ].filter(Boolean);
  const trilhaIds = [...new Set(ids)];

  // Exatamente um alvo, e ao menos um produto.
  if (trilhaIds.length === 0 || (!userId && !teamId) || (userId && teamId)) return;

  // Alvo precisa ser do tenant.
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

  // Produtos válidos dentro do escopo de conteúdo do tenant.
  const validTrilhas = await prisma.trilha.findMany({
    where: { id: { in: trilhaIds }, tenantId: { in: contentTenantIds(admin.tenant) } },
    select: { id: true },
  });
  if (validTrilhas.length === 0) return;

  const startDate = startRaw ? new Date(startRaw) : null;
  const dueDate = dueRaw ? new Date(dueRaw) : null;

  for (const t of validTrilhas) {
    // Não duplica a mesma atribuição (produto + alvo): atualiza as datas.
    const existing = await prisma.trainingAssignment.findFirst({
      where: { tenantId: admin.tenantId, trilhaId: t.id, userId, teamId },
      select: { id: true },
    });
    if (existing) {
      await prisma.trainingAssignment.update({
        where: { id: existing.id },
        data: { startDate, dueDate, required },
      });
    } else {
      await prisma.trainingAssignment.create({
        data: { tenantId: admin.tenantId, trilhaId: t.id, userId, teamId, startDate, dueDate, required, createdById: admin.id },
      });
    }
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

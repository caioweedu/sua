"use server";

// Onda 3 — Gestão de Equipes & RH · Fatia F0 (organograma).
// Server actions para montar o organograma em árvore (Team), definir liderança
// (TeamLead: gestor/supervisor) e alocar pessoas às equipes (User.teamId).
// Tudo escopado por tenant e protegido por requireAdmin.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) throw new Error("Sem permissão.");
  return user;
}

// Confirma que a equipe pertence ao tenant do admin (isolamento entre filhas).
async function ownedTeam(tenantId: string, teamId: string) {
  return prisma.team.findFirst({ where: { id: teamId, tenantId }, select: { id: true, parentId: true } });
}

// --- Equipes -------------------------------------------------------------
export async function createTeam(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // Equipe-mãe opcional (para aninhar como subequipe). Só aceita uma equipe do
  // próprio tenant — evita "pendurar" uma equipe na árvore de outra filha.
  let parentId = String(formData.get("parentId") ?? "").trim() || null;
  if (parentId) {
    const parent = await ownedTeam(user.tenantId, parentId);
    if (!parent) parentId = null;
  }

  const order = await prisma.team.count({ where: { tenantId: user.tenantId, parentId } });
  await prisma.team.create({
    data: { tenantId: user.tenantId, name, parentId, order },
  });
  revalidatePath("/admin/equipes");
}

export async function renameTeam(teamId: string, formData: FormData) {
  const user = await requireAdmin();
  if (!(await ownedTeam(user.tenantId, teamId))) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.team.update({ where: { id: teamId }, data: { name } });
  revalidatePath("/admin/equipes");
}

export async function deleteTeam(teamId: string) {
  const user = await requireAdmin();
  const team = await ownedTeam(user.tenantId, teamId);
  if (!team) return;
  // Não órfã as subequipes: reparenta os filhos para a mãe da equipe removida
  // (sobem um nível). Os membros ficam sem equipe (FK SET NULL). As lideranças
  // desta equipe caem em cascata.
  await prisma.team.updateMany({ where: { parentId: teamId }, data: { parentId: team.parentId } });
  await prisma.team.delete({ where: { id: teamId } });
  revalidatePath("/admin/equipes");
}

// Reordena a equipe entre suas irmãs (mesmo parentId).
export async function moveTeam(teamId: string, dir: "up" | "down") {
  const user = await requireAdmin();
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId: user.tenantId },
    select: { id: true, parentId: true, order: true },
  });
  if (!team) return;
  const siblings = await prisma.team.findMany({
    where: { tenantId: user.tenantId, parentId: team.parentId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const idx = siblings.findIndex((s) => s.id === teamId);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= siblings.length) return;
  // Normaliza a ordem trocando as posições dos dois vizinhos.
  await prisma.$transaction([
    ...siblings.map((s, i) =>
      prisma.team.update({
        where: { id: s.id },
        data: { order: i === idx ? swap : i === swap ? idx : i },
      })
    ),
  ]);
  revalidatePath("/admin/equipes");
}

// --- Liderança (gestor/supervisor) ---------------------------------------
export async function setTeamLead(teamId: string, formData: FormData) {
  const user = await requireAdmin();
  if (!(await ownedTeam(user.tenantId, teamId))) return;
  const userId = String(formData.get("userId") ?? "").trim();
  const role = String(formData.get("role") ?? "MANAGER") === "SUPERVISOR" ? "SUPERVISOR" : "MANAGER";
  if (!userId) return;
  // A pessoa precisa ser do mesmo tenant.
  const target = await prisma.user.findFirst({
    where: { id: userId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!target) return;
  // Único por (teamId, userId): trocar o papel de quem já lidera a equipe.
  await prisma.teamLead.upsert({
    where: { teamId_userId: { teamId, userId } },
    update: { role },
    create: { teamId, userId, role },
  });
  revalidatePath("/admin/equipes");
}

export async function removeTeamLead(leadId: string) {
  const user = await requireAdmin();
  // Garante que a liderança é de uma equipe do tenant do admin.
  const lead = await prisma.teamLead.findFirst({
    where: { id: leadId, team: { tenantId: user.tenantId } },
    select: { id: true },
  });
  if (!lead) return;
  await prisma.teamLead.delete({ where: { id: leadId } });
  revalidatePath("/admin/equipes");
}

// --- Alocação de pessoas -------------------------------------------------
export async function assignMember(teamId: string, formData: FormData) {
  const user = await requireAdmin();
  if (!(await ownedTeam(user.tenantId, teamId))) return;
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return;
  await prisma.user.updateMany({
    where: { id: userId, tenantId: user.tenantId },
    data: { teamId },
  });
  revalidatePath("/admin/equipes");
}

export async function removeMember(userId: string) {
  const user = await requireAdmin();
  await prisma.user.updateMany({
    where: { id: userId, tenantId: user.tenantId },
    data: { teamId: null },
  });
  revalidatePath("/admin/equipes");
}

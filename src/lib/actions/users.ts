"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin, hashPassword } from "@/lib/auth";
import { sendEmail, accessEmailHtml, emailConfigured } from "@/lib/email";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) throw new Error("Sem permissão.");
  return user;
}

// URL base da requisição atual (para montar links de acesso absolutos).
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// --- Edição do aluno -----------------------------------------------------
export async function updateUser(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const target = await prisma.user.findFirst({
    where: { id: userId, tenantId: admin.tenantId },
    select: { id: true },
  });
  if (!target) return;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const accessProfileId = String(formData.get("accessProfileId") ?? "").trim() || null;
  // Equipe (organograma). "" = sem equipe. Só aceita equipe do mesmo tenant.
  const teamRaw = String(formData.get("teamId") ?? "").trim() || null;
  let teamId: string | null = null;
  if (teamRaw) {
    const team = await prisma.team.findFirst({
      where: { id: teamRaw, tenantId: admin.tenantId },
      select: { id: true },
    });
    teamId = team?.id ?? null;
  }
  const active = formData.get("active") != null;

  if (!name || !email) return;

  // E-mail é único por tenant: bloqueia colisão com outro usuário.
  const clash = await prisma.user.findFirst({
    where: { tenantId: admin.tenantId, email, id: { not: userId } },
    select: { id: true },
  });
  if (clash) throw new Error("Já existe um usuário com este e-mail.");

  await prisma.user.update({
    where: { id: userId, tenantId: admin.tenantId },
    data: { name, email, phone, accessProfileId, teamId, active },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/alunos/${userId}`);
}

// Admin define uma nova senha diretamente (sem link).
export async function resetUserPassword(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return;
  const target = await prisma.user.findFirst({
    where: { id: userId, tenantId: admin.tenantId },
    select: { id: true },
  });
  if (!target) return;
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  revalidatePath(`/admin/alunos/${userId}`);
}

export type AccessLinkResult = {
  ok: boolean;
  purpose?: "INVITE" | "RESET";
  sent?: boolean;
  url?: string;
  error?: string;
};

// Gera um token de uso único e envia (ou devolve) o link de acesso do aluno —
// convite (definir senha) ou redefinição. Se o e-mail não estiver configurado,
// devolve a URL para o admin copiar e enviar manualmente.
export async function sendAccessLink(
  _prev: AccessLinkResult,
  formData: FormData
): Promise<AccessLinkResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const purpose = String(formData.get("purpose") ?? "INVITE") === "RESET" ? "RESET" : "INVITE";

  const target = await prisma.user.findFirst({
    where: { id: userId, tenantId: admin.tenantId },
    select: { id: true, name: true, email: true },
  });
  if (!target) return { ok: false, error: "Aluno não encontrado." };

  // Invalida tokens anteriores ainda não usados e cria um novo (7 dias).
  await prisma.authToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.authToken.create({
    data: {
      token,
      userId,
      purpose,
      expiresAt: new Date(Date.now() + 7 * 864e5),
    },
  });

  const url = `${await baseUrl()}/definir-senha/${token}`;

  if (!emailConfigured()) {
    // Sem provedor de e-mail: devolve o link para envio manual.
    return { ok: true, purpose, sent: false, url };
  }

  const res = await sendEmail({
    to: target.email,
    fromName: admin.tenant.name,
    subject:
      purpose === "INVITE"
        ? `Seu acesso à ${admin.tenant.name}`
        : `Redefinição de senha · ${admin.tenant.name}`,
    html: accessEmailHtml({
      studentName: target.name,
      tenantName: admin.tenant.name,
      actionUrl: url,
      purpose,
      brandColor: admin.tenant.brandColor,
      logoUrl: admin.tenant.logoUrl,
    }),
  });

  return { ok: true, purpose, sent: res.sent, url, error: res.error };
}

// --- Página pública de definição de senha (via token) --------------------
export type SetPasswordResult = { ok: boolean; error?: string };

export async function setPasswordWithToken(
  token: string,
  _prev: SetPasswordResult,
  formData: FormData
): Promise<SetPasswordResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 6) return { ok: false, error: "A senha deve ter ao menos 6 caracteres." };
  if (password !== confirm) return { ok: false, error: "As senhas não conferem." };

  const record = await prisma.authToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "Link inválido ou expirado. Peça um novo ao administrador." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return { ok: true };
}

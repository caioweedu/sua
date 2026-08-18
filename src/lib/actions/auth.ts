"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { sendEmail, accessEmailHtml, emailConfigured } from "@/lib/email";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const tenant = await resolveTenant();
  if (!tenant) return { error: "Plataforma não configurada." };

  // O login é feito dentro do tenant resolvido pelo domínio. Um SUPER_ADMIN da
  // mãe também consegue logar pela mãe e navegar entre as filhas.
  const user = await prisma.user.findFirst({
    where: { email: parsed.data.email.toLowerCase(), tenantId: tenant.id, active: true },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos." };
  }

  await createSession({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    name: user.name,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// --- "Esqueci minha senha" (autoatendimento) -----------------------------
// Envia um link de redefinição por e-mail. Por segurança, a resposta é sempre
// genérica (não revela se o e-mail existe) e o link NUNCA é devolvido na tela —
// só chega pelo e-mail do próprio usuário.
export type ForgotState = { done?: boolean; error?: string };

export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Informe um e-mail válido." };

  const tenant = await resolveTenant();
  if (!tenant) return { error: "Plataforma não configurada." };

  const user = await prisma.user.findFirst({
    where: { email, tenantId: tenant.id, active: true },
    select: { id: true, name: true, email: true },
  });

  // Só dispara o e-mail se o usuário existir e houver provedor configurado —
  // mas a resposta é a mesma nos dois casos (evita enumeração de e-mails).
  if (user && emailConfigured()) {
    await prisma.authToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.authToken.create({
      data: {
        token,
        userId: user.id,
        purpose: "RESET",
        expiresAt: new Date(Date.now() + 7 * 864e5),
      },
    });

    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    const url = `${proto}://${host}/definir-senha/${token}`;

    await sendEmail({
      to: user.email,
      fromName: tenant.name,
      subject: `Redefinição de senha · ${tenant.name}`,
      html: accessEmailHtml({
        studentName: user.name,
        tenantName: tenant.name,
        actionUrl: url,
        purpose: "RESET",
        brandColor: tenant.brandColor,
        logoUrl: tenant.logoUrl,
      }),
    });
  }

  return { done: true };
}

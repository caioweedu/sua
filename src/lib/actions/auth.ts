"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";

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

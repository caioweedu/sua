import "server-only";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { getSession } from "./session";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Retorna o usuário logado (com tenant), ou null.
//
// Impersonação de filha: a Weedu (SUPER_ADMIN) pode "entrar" numa filha sua via
// ?tenant=<slug> (cookie tenant_override). Enquanto o cookie estiver ativo, o
// usuário opera COMO aquela filha — tenant e papel viram os da filha
// (TENANT_ADMIN), então ele vê só o conteúdo/admin da filha, sem os painéis de
// super-admin. Para sair, basta ?tenant= (vazio), que limpa o cookie.
// Memoizado por request (React cache): layout + página compartilham a MESMA
// consulta de usuário/tenant, em vez de bater no banco duas vezes na navegação.
export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { tenant: true },
  });
  if (!user || !user.active) return null;

  if (user.role === "SUPER_ADMIN") {
    const override = (await cookies()).get("tenant_override")?.value;
    if (override && override !== user.tenant.slug) {
      const daughter = await prisma.tenant.findFirst({
        where: { slug: override, type: "DAUGHTER", parentId: user.tenantId, active: true },
      });
      if (daughter) {
        return {
          ...user,
          tenantId: daughter.id,
          tenant: daughter,
          role: "TENANT_ADMIN",
          impersonating: true as const,
        };
      }
    }
  }
  return user;
});

export function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "TENANT_ADMIN";
}

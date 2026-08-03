import "server-only";
import bcrypt from "bcryptjs";
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
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { tenant: true },
  });
  if (!user || !user.active) return null;
  return user;
}

export function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "TENANT_ADMIN";
}

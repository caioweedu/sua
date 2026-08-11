import "server-only";
import { prisma } from "./db";

type AccessUser = { role: string; accessProfileId: string | null };

// Escopo de CONTEÚDO visível a um tenant (herança mãe→filha):
//  - filha: vê o conteúdo próprio + o da mãe (compartilhado com todos).
//  - mãe: vê só o próprio.
// A escrita continua escopada ao tenant do usuário (a filha não edita a mãe),
// e o conteúdo específico da filha nunca aparece na mãe (direção única).
export function contentTenantIds(tenant: {
  id: string;
  type: string;
  parentId: string | null;
}): string[] {
  return tenant.type === "DAUGHTER" && tenant.parentId
    ? [tenant.id, tenant.parentId]
    : [tenant.id];
}

// Retorna a lista de IDs de vitrines que o usuário pode acessar, ou `null`
// quando pode ver TODAS (admins, ou alunos sem perfil definido).
export async function allowedVitrineIds(
  user: AccessUser
): Promise<string[] | null> {
  // Admins enxergam tudo.
  if (user.role !== "STUDENT") return null;
  // Aluno sem perfil: aberto por padrão (vê todas as vitrines publicadas).
  if (!user.accessProfileId) return null;

  const profile = await prisma.accessProfile.findUnique({
    where: { id: user.accessProfileId },
    select: { vitrines: { select: { id: true } } },
  });
  // Perfil sem vitrines liberadas: não vê nada.
  return profile ? profile.vitrines.map((v) => v.id) : [];
}

// IDs de vitrines da mãe que ESTA filha optou por ocultar (não herdar). Para a
// mãe (ou tenant sem pai) retorna lista vazia. Usado para excluir o conteúdo
// herdado que a filha não quer exibir.
export async function hiddenSharedVitrineIds(tenant: {
  id: string;
  type: string;
  parentId: string | null;
}): Promise<string[]> {
  if (!(tenant.type === "DAUGHTER" && tenant.parentId)) return [];
  const rows = await prisma.sharedVitrineOptOut.findMany({
    where: { tenantId: tenant.id },
    select: { vitrineId: true },
  });
  return rows.map((r) => r.vitrineId);
}

// Verifica se o usuário pode acessar uma vitrine específica.
export function canAccessVitrine(allowed: string[] | null, vitrineId: string | null) {
  if (allowed === null) return true; // acesso total
  if (!vitrineId) return false; // conteúdo sem vitrine, com perfil restrito
  return allowed.includes(vitrineId);
}

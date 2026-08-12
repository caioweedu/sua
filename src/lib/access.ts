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

type ScopeTenant = { id: string; type: string; parentId: string | null };

// IDs de vitrines da MÃE que foram LIBERADAS para esta filha (white-label). A
// mãe (ou tenant sem pai) não recebe nada compartilhado → lista vazia.
export async function grantedSharedVitrineIds(tenant: ScopeTenant): Promise<string[]> {
  if (!(tenant.type === "DAUGHTER" && tenant.parentId)) return [];
  const rows = await prisma.sharedVitrineGrant.findMany({
    where: { tenantId: tenant.id },
    select: { vitrineId: true },
  });
  return rows.map((r) => r.vitrineId);
}

// Fragmento `where` das vitrines visíveis a um tenant:
//  - mãe: só as próprias.
//  - filha: as próprias + as vitrines da mãe liberadas para ela.
export async function visibleVitrineWhere(tenant: ScopeTenant) {
  if (!(tenant.type === "DAUGHTER" && tenant.parentId)) {
    return { tenantId: tenant.id };
  }
  const granted = await grantedSharedVitrineIds(tenant);
  return {
    OR: [
      { tenantId: tenant.id },
      { tenantId: tenant.parentId, id: { in: granted } },
    ],
  };
}

// Uma vitrine específica é visível a este tenant? (própria ou liberada da mãe)
export function vitrineVisible(
  tenant: ScopeTenant,
  vitrineTenantId: string,
  vitrineId: string,
  grantedIds: string[]
): boolean {
  if (vitrineTenantId === tenant.id) return true;
  if (tenant.type === "DAUGHTER" && tenant.parentId === vitrineTenantId) {
    return grantedIds.includes(vitrineId);
  }
  return false;
}

// Verifica se o usuário pode acessar uma vitrine específica.
export function canAccessVitrine(allowed: string[] | null, vitrineId: string | null) {
  if (allowed === null) return true; // acesso total
  if (!vitrineId) return false; // conteúdo sem vitrine, com perfil restrito
  return allowed.includes(vitrineId);
}

import "server-only";
import { prisma } from "./db";

type AccessUser = { role: string; accessProfileId: string | null };

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

// Verifica se o usuário pode acessar uma vitrine específica.
export function canAccessVitrine(allowed: string[] | null, vitrineId: string | null) {
  if (allowed === null) return true; // acesso total
  if (!vitrineId) return false; // conteúdo sem vitrine, com perfil restrito
  return allowed.includes(vitrineId);
}

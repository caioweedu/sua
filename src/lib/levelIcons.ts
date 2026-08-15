import "server-only";
import { prisma } from "./db";

// Ícones (arte) por nível cadastrados pela Weedu. Retorna um mapa
// nível → URL. Sem cadastro, a UI usa o emoji do catálogo (levelBadges.ts).
export async function getLevelIconMap(): Promise<Map<number, string>> {
  const rows = await prisma.levelIcon.findMany({ select: { level: true, iconUrl: true } });
  return new Map(rows.map((r) => [r.level, r.iconUrl]));
}

import "server-only";
import { prisma } from "./db";
import type { TeamNode } from "./teamCockpit";

// Onda 3 · F3c — filtro/resumo por equipe para Compliance e Planejamento.
// Carrega só a estrutura do organograma (nomes + hierarquia) — leve, uma
// consulta. Os membros de cada equipe são deduzidos das próprias linhas
// (cada linha traz o teamId da pessoa), então não há consulta extra de
// pertencimento aqui.

export type OrderedTeam = { id: string; name: string; parentId: string | null; depth: number };

export type TeamTree = {
  teams: TeamNode[];
  childrenOf: Map<string | null, TeamNode[]>;
  roots: TeamNode[];
  ordered: OrderedTeam[]; // DFS (pais antes dos filhos), com profundidade
};

export async function loadTeamTree(tenantId: string): Promise<TeamTree> {
  const teams = await prisma.team.findMany({
    where: { tenantId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true },
  });

  const childrenOf = new Map<string | null, TeamNode[]>();
  for (const t of teams) {
    const key = t.parentId ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(t);
  }
  const roots = childrenOf.get(null) ?? [];

  const ordered: OrderedTeam[] = [];
  const walk = (nodes: TeamNode[], depth: number) => {
    for (const n of nodes) {
      ordered.push({ id: n.id, name: n.name, parentId: n.parentId, depth });
      walk(childrenOf.get(n.id) ?? [], depth + 1);
    }
  };
  walk(roots, 0);

  return { teams, childrenOf, roots, ordered };
}

// IDs (do conjunto informado) que pertencem à equipe OU a qualquer subequipe.
// `directOf` mapeia teamId -> ids diretos (construído a partir das linhas).
export function subtreeIds(
  teamId: string,
  childrenOf: Map<string | null, TeamNode[]>,
  directOf: Map<string, string[]>
): string[] {
  const ids = [...(directOf.get(teamId) ?? [])];
  for (const c of childrenOf.get(teamId) ?? []) {
    ids.push(...subtreeIds(c.id, childrenOf, directOf));
  }
  return ids;
}

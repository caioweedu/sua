// ---------------------------------------------------------------------------
// Badges de NÍVEL (Gamificação — Onda 2, extra) — 20 níveis temáticos
// ---------------------------------------------------------------------------
// Cada nível (1..20) tem um nome, um emoji e uma COR — pensados para virar
// também botons físicos de crachá. Os nomes são ORIGINAIS (evocam arquétipos de
// cultura pop sem usar marcas registradas, o que é importante para merch).
// Para renomear/recolorir, edite só este arquivo.

export const MAX_LEVEL = 20;

export type LevelBadge = {
  level: number;
  name: string;
  emoji: string;
  color: string; // fundo (hex) — cor do boton
  fg: string; // cor do texto sobre o fundo
};

export const LEVEL_BADGES: LevelBadge[] = [
  { level: 1, name: "Aprendiz", emoji: "🌱", color: "#22c55e", fg: "#ffffff" },
  { level: 2, name: "Explorador", emoji: "🧭", color: "#10b981", fg: "#ffffff" },
  { level: 3, name: "Aventureiro", emoji: "🗺️", color: "#14b8a6", fg: "#ffffff" },
  { level: 4, name: "Batedor", emoji: "🏕️", color: "#06b6d4", fg: "#ffffff" },
  { level: 5, name: "Guardião", emoji: "🛡️", color: "#0ea5e9", fg: "#ffffff" },
  { level: 6, name: "Cavaleiro", emoji: "⚔️", color: "#3b82f6", fg: "#ffffff" },
  { level: 7, name: "Arqueiro", emoji: "🏹", color: "#6366f1", fg: "#ffffff" },
  { level: 8, name: "Domador de Dragões", emoji: "🐉", color: "#8b5cf6", fg: "#ffffff" },
  { level: 9, name: "Feiticeiro", emoji: "🪄", color: "#a855f7", fg: "#ffffff" },
  { level: 10, name: "Mago Arcano", emoji: "🔮", color: "#d946ef", fg: "#ffffff" },
  { level: 11, name: "Mestre do Sabre", emoji: "✨", color: "#ec4899", fg: "#ffffff" },
  { level: 12, name: "Senhor do Norte", emoji: "❄️", color: "#475569", fg: "#ffffff" },
  { level: 13, name: "Caçador Estelar", emoji: "🚀", color: "#0891b2", fg: "#ffffff" },
  { level: 14, name: "Corsário", emoji: "🏴‍☠️", color: "#334155", fg: "#ffffff" },
  { level: 15, name: "Alquimista", emoji: "⚗️", color: "#7c3aed", fg: "#ffffff" },
  { level: 16, name: "Paladino", emoji: "🌟", color: "#f59e0b", fg: "#1f2937" },
  { level: 17, name: "Comandante", emoji: "🎖️", color: "#ea580c", fg: "#ffffff" },
  { level: 18, name: "Arconte", emoji: "👑", color: "#b91c1c", fg: "#ffffff" },
  { level: 19, name: "Titã", emoji: "⚡", color: "#7f1d1d", fg: "#ffffff" },
  { level: 20, name: "Lenda Imortal", emoji: "🏆", color: "#eab308", fg: "#1f2937" },
];

const BY_LEVEL = new Map(LEVEL_BADGES.map((b) => [b.level, b]));

// Retorna o badge do nível (limita entre 1 e MAX_LEVEL).
export function getLevelBadge(level: number): LevelBadge {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, level));
  return BY_LEVEL.get(clamped) ?? LEVEL_BADGES[0];
}

// ---------------------------------------------------------------------------
// Badges de NÍVEL (Gamificação — Onda 2, extra) — 20 níveis temáticos
// ---------------------------------------------------------------------------
// Jornada de maturidade em GESTÃO DE RESULTADOS (a especialidade da Weedu):
// metas, indicadores, rotinas, produtividade, liderança, equipe, causas dos
// problemas e resultados — culminando numa faixa Weedu. Cada nível tem nome,
// emoji e COR própria, pensados também para virar botons físicos de crachá.
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
  { level: 1, name: "Iniciante", emoji: "🌱", color: "#22c55e", fg: "#ffffff" },
  { level: 2, name: "Aprendiz de Gestão", emoji: "📘", color: "#16a34a", fg: "#ffffff" },
  { level: 3, name: "Organizador de Rotinas", emoji: "🗂️", color: "#059669", fg: "#ffffff" },
  { level: 4, name: "Executor", emoji: "🎯", color: "#0d9488", fg: "#ffffff" },
  { level: 5, name: "Analista de Metas", emoji: "📊", color: "#0891b2", fg: "#ffffff" },
  { level: 6, name: "Guardião dos Indicadores", emoji: "📈", color: "#0284c7", fg: "#ffffff" },
  { level: 7, name: "Mestre da Produtividade", emoji: "⏱️", color: "#2563eb", fg: "#ffffff" },
  { level: 8, name: "Solucionador de Problemas", emoji: "🧩", color: "#4f46e5", fg: "#ffffff" },
  { level: 9, name: "Líder de Equipe", emoji: "🤝", color: "#7c3aed", fg: "#ffffff" },
  { level: 10, name: "Gestor de Resultados", emoji: "🏅", color: "#9333ea", fg: "#ffffff" },
  { level: 11, name: "Estrategista", emoji: "🧠", color: "#c026d3", fg: "#ffffff" },
  { level: 12, name: "Condutor de Mudanças", emoji: "🚀", color: "#db2777", fg: "#ffffff" },
  { level: 13, name: "Arquiteto de Processos", emoji: "🏗️", color: "#e11d48", fg: "#ffffff" },
  { level: 14, name: "Mentor", emoji: "🧭", color: "#dc2626", fg: "#ffffff" },
  { level: 15, name: "Otimizador", emoji: "🔧", color: "#ea580c", fg: "#ffffff" },
  { level: 16, name: "Líder Inspirador", emoji: "🌟", color: "#d97706", fg: "#ffffff" },
  { level: 17, name: "Visionário", emoji: "🔭", color: "#b45309", fg: "#ffffff" },
  { level: 18, name: "Mestre da Gestão", emoji: "👑", color: "#7f1d1d", fg: "#ffffff" },
  { level: 19, name: "Lenda dos Resultados", emoji: "🔥", color: "#1f2937", fg: "#ffffff" },
  { level: 20, name: "Ícone Weedu", emoji: "🏆", color: "#eab308", fg: "#1f2937" },
];

const BY_LEVEL = new Map(LEVEL_BADGES.map((b) => [b.level, b]));

// Retorna o badge do nível (limita entre 1 e MAX_LEVEL).
export function getLevelBadge(level: number): LevelBadge {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, level));
  return BY_LEVEL.get(clamped) ?? LEVEL_BADGES[0];
}

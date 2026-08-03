// Gera uma capa em gradiente determinística a partir de um texto (título da
// trilha), para trilhas sem imagem de capa. Mesma trilha → sempre a mesma capa.
const PALETTES: [string, string][] = [
  ["#0ea5e9", "#1e3a8a"],
  ["#8b5cf6", "#4c1d95"],
  ["#f97316", "#7c2d12"],
  ["#10b981", "#064e3b"],
  ["#ec4899", "#831843"],
  ["#06b6d4", "#0e7490"],
  ["#eab308", "#854d0e"],
  ["#6366f1", "#312e81"],
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function coverFor(seed: string): { c1: string; c2: string } {
  const [c1, c2] = PALETTES[hashString(seed) % PALETTES.length];
  return { c1, c2 };
}

// Ícone temático simples por categoria/título.
export function iconFor(seed: string): string {
  const s = seed.toLowerCase();
  if (/lideran|gestor|gest[aã]o/.test(s)) return "🧭";
  if (/resultad|meta|indicador|lucrativ/.test(s)) return "📈";
  if (/equipe|pessoas|time/.test(s)) return "🤝";
  if (/problema|causa|análise|analise/.test(s)) return "🧩";
  if (/produtiv|rotina|processo/.test(s)) return "⚙️";
  if (/venda|comercial|prospec/.test(s)) return "💼";
  return "🎓";
}

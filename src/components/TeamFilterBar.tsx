import Link from "next/link";
import Icon from "@/components/Icon";

// Onda 3 · F3c — resumo por equipe clicável (filtro) para Compliance e
// Planejamento. Cada card mostra até dois indicadores da equipe e, ao clicar,
// filtra a lista abaixo (via querystring ?equipe=<id>). Server component: só
// links, sem estado no cliente.

export type Tone = "good" | "warn" | "bad" | "neutral";

export type TeamStat = { value: string; label: string; tone?: Tone };

export type TeamFilterItem = {
  key: string; // "all" | teamId | "none"
  name: string;
  depth?: number;
  pessoas: number;
  stats: TeamStat[]; // 1 a 2 indicadores
};

const toneClass: Record<Tone, string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
  neutral: "text-ink",
};

export default function TeamFilterBar({
  items,
  active,
  baseHref,
}: {
  items: TeamFilterItem[];
  active: string; // "all" | teamId | "none"
  baseHref: string;
}) {
  if (items.length <= 1) return null; // só "Todas" = sem equipes, não mostra

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Por equipe</h2>
        {active !== "all" && (
          <Link href={baseHref} className="text-xs font-medium text-brand hover:underline">
            limpar filtro
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => {
          const isActive = it.key === active;
          const href = it.key === "all" ? baseHref : `${baseHref}?equipe=${encodeURIComponent(it.key)}`;
          const indent = (it.depth ?? 0) > 0;
          return (
            <Link
              key={it.key}
              href={href}
              aria-current={isActive ? "true" : undefined}
              className={`flex flex-col rounded-xl border px-3 py-2 transition ${
                isActive
                  ? "border-brand bg-brand/10"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-ink">
                {indent && <Icon name="chevronRight" size={11} className="shrink-0 text-slate-400" />}
                <span className="truncate">{it.name}</span>
              </span>
              <span className="mt-1 flex items-end gap-3">
                {it.stats.map((s, i) => (
                  <span key={i} className="flex flex-col">
                    <span className={`text-lg font-black leading-none tabular-nums ${toneClass[s.tone ?? "neutral"]}`}>
                      {s.value}
                    </span>
                    <span className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{s.label}</span>
                  </span>
                ))}
              </span>
              <span className="mt-1.5 text-[11px] text-slate-400">{it.pessoas} pessoa(s)</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

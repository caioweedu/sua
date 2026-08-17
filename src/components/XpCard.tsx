import Link from "next/link";
import type { GamificationStatus } from "@/lib/gamification";
import { getLevelBadge, MAX_LEVEL } from "@/lib/levelBadges";

// Cartão de XP + nível do aluno (Gamificação — Onda 2, Fatia 1).
// Mostra o badge temático do nível atual (nome + cor + emoji).
export default function XpCard({
  status,
  iconUrl,
}: {
  status: GamificationStatus;
  iconUrl?: string;
}) {
  const { xp, level, intoLevel, levelSpan, nextLevelAt, progressPct } = status;
  const faltam = Math.max(0, nextLevelAt - xp);
  const badge = getLevelBadge(level);
  const atMax = level >= MAX_LEVEL;

  return (
    <div className="s-card mx-4 mt-8 flex items-center gap-4 rounded-2xl p-4 sm:p-5">
      {/* Selo do nível: arte cadastrada ou, na falta, cor + emoji */}
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt={`Nível ${level} — ${badge.name}`}
          className="h-16 w-16 shrink-0 rounded-full object-cover shadow-inner ring-2 ring-black/5"
        />
      ) : (
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl shadow-inner"
          style={{ background: badge.color, color: badge.fg }}
        >
          <span className="text-2xl leading-none">{badge.emoji}</span>
          <span className="mt-0.5 text-[10px] font-bold uppercase leading-none tracking-wide opacity-90">
            Nv {level}
          </span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold" style={{ color: badge.color }}>
            {badge.name}
          </p>
          <p className="s-muted shrink-0 text-xs">
            {atMax ? "nível máximo 🏆" : `faltam ${faltam} XP p/ o nível ${level + 1}`}
          </p>
        </div>
        {/* Barra de progresso do nível atual, na cor do badge */}
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.min(100, Math.max(2, progressPct))}%`,
              background: badge.color,
            }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="s-muted text-[11px]">
            {xp} XP{atMax ? "" : ` · ${intoLevel}/${levelSpan} neste nível`}
          </p>
          <Link href="/niveis" className="text-[11px] font-semibold hover:underline" style={{ color: badge.color }}>
            ver todos os níveis →
          </Link>
        </div>
      </div>
    </div>
  );
}

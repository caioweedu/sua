import type { GamificationStatus } from "@/lib/gamification";

// Cartão de XP + nível do aluno (Gamificação — Onda 2, Fatia 1).
// Componente puramente apresentacional; recebe o status já calculado.
export default function XpCard({ status }: { status: GamificationStatus }) {
  const { xp, level, intoLevel, levelSpan, nextLevelAt, progressPct } = status;
  const faltam = Math.max(0, nextLevelAt - xp);

  return (
    <div className="s-card mx-4 mt-8 flex items-center gap-4 rounded-2xl p-4 sm:p-5">
      {/* Selo do nível */}
      <div className="brand-immersive flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-white shadow-inner">
        <span className="text-[10px] font-semibold uppercase leading-none tracking-wide opacity-80">
          Nível
        </span>
        <span className="text-2xl font-black leading-none">{level}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold">{xp} XP</p>
          <p className="s-muted text-xs">
            {faltam > 0 ? `faltam ${faltam} XP p/ o nível ${level + 1}` : "nível máximo"}
          </p>
        </div>
        {/* Barra de progresso do nível atual */}
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
          <div
            className="brand-immersive h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(2, progressPct))}%` }}
          />
        </div>
        <p className="s-muted mt-1 text-[11px]">
          {intoLevel}/{levelSpan} XP neste nível
        </p>
      </div>
    </div>
  );
}

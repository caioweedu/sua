import type { BadgeView } from "@/lib/badges";

// Vitrine de conquistas (Gamificação — Onda 2, Fatia 2).
// Mostra o catálogo inteiro: conquistadas em destaque, bloqueadas esmaecidas —
// dá a sensação de coleção e motiva a completar.
export default function BadgesStrip({ badges }: { badges: BadgeView[] }) {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="s-card mx-4 mt-4 rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">Conquistas</h3>
        <span className="s-muted text-xs">
          {earnedCount}/{badges.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {badges.map((b) => (
          <div
            key={b.key}
            title={`${b.title} — ${b.description}`}
            className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center transition ${
              b.earned ? "bg-black/5 dark:bg-white/10" : "opacity-40 grayscale"
            }`}
          >
            <span className="text-2xl leading-none sm:text-3xl">{b.emoji}</span>
            <span className="text-[11px] font-semibold leading-tight">{b.title}</span>
            {!b.earned && (
              <span className="s-muted text-[10px] leading-tight">🔒 bloqueada</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Card da ofensiva (Gamificação — Onda 2, Fatia 3).
// Mostra a sequência de dias consecutivos de estudo.
export default function StreakCard({ streak }: { streak: number }) {
  const ativo = streak > 0;
  return (
    <div className="s-card mx-4 mt-4 flex items-center gap-4 rounded-2xl p-4 sm:p-5">
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl ${
          ativo ? "bg-orange-500/15" : "bg-black/5 opacity-50 dark:bg-white/10"
        }`}
      >
        🔥
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {ativo ? (
            <>
              {streak} {streak === 1 ? "dia" : "dias"} seguidos
            </>
          ) : (
            "Comece sua ofensiva hoje"
          )}
        </p>
        <p className="s-muted text-xs">
          {ativo
            ? "Estude um pouco todo dia para manter a sequência acesa."
            : "Conclua uma aula hoje para iniciar sua sequência. 🔥"}
        </p>
      </div>
    </div>
  );
}

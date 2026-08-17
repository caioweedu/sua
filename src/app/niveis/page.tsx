import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { getGamificationStatus } from "@/lib/gamification";
import { LEVEL_BADGES } from "@/lib/levelBadges";
import { getLevelIconMap } from "@/lib/levelIcons";

export default async function NiveisPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.tenant.gamificationEnabled) redirect("/dashboard");

  const [status, icons] = await Promise.all([
    getGamificationStatus(user.id),
    getLevelIconMap(),
  ]);
  const light = user.tenant.theme === "light";

  return (
    <AppShell user={user} tenant={user.tenant} dark light={light}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Níveis</h1>
            <p className="s-muted text-sm">
              Você está no nível {status.level} de {LEVEL_BADGES.length}. Ganhe XP
              concluindo aulas, provas e certificados.
            </p>
          </div>
          <Link href="/dashboard" className="s-muted shrink-0 text-sm hover:underline">
            ← Voltar
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LEVEL_BADGES.map((b) => {
            const unlocked = status.level >= b.level;
            const current = status.level === b.level;
            return (
              <div
                key={b.level}
                className={`s-card flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition ${
                  unlocked ? "" : "opacity-40 grayscale"
                } ${current ? "ring-2 ring-offset-2 ring-offset-transparent" : ""}`}
                style={current ? { boxShadow: `0 0 0 2px ${b.color}` } : undefined}
              >
                {icons.get(b.level) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={icons.get(b.level)}
                    alt={`Nível ${b.level} — ${b.name}`}
                    className="h-16 w-16 rounded-full object-cover shadow-inner ring-2 ring-black/5"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-inner"
                    style={{ background: b.color, color: b.fg }}
                  >
                    {b.emoji}
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: b.color }}>
                    Nível {b.level}
                  </p>
                  <p className="text-sm font-semibold leading-tight">{b.name}</p>
                </div>
                {!unlocked && <span className="s-muted text-[10px]">🔒 bloqueado</span>}
                {current && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: b.color, color: b.fg }}
                  >
                    você está aqui
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

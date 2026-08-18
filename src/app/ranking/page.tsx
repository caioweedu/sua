import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { getRanking, rankingActive } from "@/lib/gamification";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function RankingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Ranking respeita a liberação da mãe + as configurações da filha (privacidade).
  if (!rankingActive(user.tenant)) {
    redirect("/dashboard");
  }

  const { rows, me } = await getRanking(user.tenantId, user.id);
  const light = user.tenant.theme === "light";
  const meInTop = !!me && rows.some((r) => r.userId === me.userId);

  return (
    <AppShell user={user} tenant={user.tenant} dark light={light}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">🏆 Ranking</h1>
          <Link href="/dashboard" className="s-muted text-sm hover:underline">
            ← Voltar
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="s-card s-muted rounded-2xl p-8 text-center">
            Ninguém pontuou ainda. Conclua aulas e provas para aparecer aqui!
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const isMe = me?.userId === r.userId;
              return (
                <li
                  key={r.userId}
                  className={`s-card flex items-center gap-3 rounded-xl p-3 ${
                    isMe ? "ring-2 ring-[var(--brand-color)]" : ""
                  }`}
                >
                  <span className="w-8 text-center text-lg font-black">
                    {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {r.name}
                    {isMe && <span className="s-muted font-normal"> (você)</span>}
                  </span>
                  <span className="shrink-0 text-sm font-bold">{r.xp} XP</span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Sua posição, quando fora do top exibido */}
        {me && !meInTop && (
          <>
            <p className="s-muted my-3 text-center text-xs">• • •</p>
            <div className="s-card flex items-center gap-3 rounded-xl p-3 ring-2 ring-[var(--brand-color)]">
              <span className="w-8 text-center text-lg font-black">{me.rank}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {me.name} <span className="s-muted font-normal">(você)</span>
              </span>
              <span className="shrink-0 text-sm font-bold">{me.xp} XP</span>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

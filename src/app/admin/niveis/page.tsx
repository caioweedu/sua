import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import SubmitButton from "@/components/SubmitButton";
import ImageUpload from "@/components/ImageUpload";
import { LEVEL_BADGES } from "@/lib/levelBadges";
import { getLevelIconMap } from "@/lib/levelIcons";
import { saveLevelIcons } from "@/lib/actions/admin";

// Arte (ícone) de cada nível — global da Weedu. Só SUPER_ADMIN. Sem arte, a
// plataforma usa o emoji padrão do nível.
export default async function AdminNiveisPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const icons = await getLevelIconMap();

  return (
    <AppShell user={user} tenant={user.tenant}>
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Administração
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">Ícones dos níveis</h1>
      <p className="mb-6 text-sm text-slate-500">
        Suba a arte de cada nível (PNG com transparência ou SVG, quadrado ~
        512×512). Sem arte, a plataforma usa o emoji padrão. Vale para a Weedu e
        todas as filhas.
      </p>

      <form action={saveLevelIcons} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LEVEL_BADGES.map((b) => (
            <div key={b.level} className="card">
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                  style={{ background: b.color, color: b.fg }}
                >
                  {b.emoji}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: b.color }}>
                    Nível {b.level}
                  </p>
                  <p className="truncate text-sm font-semibold">{b.name}</p>
                </div>
              </div>
              <ImageUpload
                name={`icon_${b.level}`}
                label="Arte do nível"
                hint="PNG/SVG quadrado. Vazio = usa o emoji."
                defaultValue={icons.get(b.level) ?? ""}
                slot={`nivel-${b.level}`}
                aspect="1 / 1"
                maxW={512}
                maxH={512}
              />
            </div>
          ))}
        </div>
        <SubmitButton pendingText="Salvando…">Salvar ícones</SubmitButton>
      </form>
    </AppShell>
  );
}

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
      <p className="mb-4 text-sm text-slate-500">
        A arte é exibida <strong>redonda</strong> (formato de boton). Sem arte
        cadastrada, a plataforma usa o emoji padrão do nível. Vale para a Weedu e
        todas as filhas.
      </p>

      {/* Especificação do arquivo — o que a arte deve seguir */}
      <div className="card mb-6 border-slate-200 bg-slate-50/60">
        <p className="mb-2 text-sm font-semibold">Como preparar a arte</p>
        <ul className="grid gap-x-8 gap-y-1.5 text-sm text-slate-600 sm:grid-cols-2">
          <li>
            <strong>Formato:</strong> PNG (fundo transparente) ou SVG (vetor —
            ideal, escala sem perder nitidez).
          </li>
          <li>
            <strong>Proporção:</strong> quadrada (1:1). O sistema recorta em
            círculo automaticamente.
          </li>
          <li>
            <strong>Tamanho na tela:</strong> 512×512 px (mínimo 256×256).
          </li>
          <li>
            <strong>Para o boton físico:</strong> guarde também uma versão em
            alta — 1024×1024 px ou o SVG — e mande essa pra gráfica.
          </li>
          <li>
            <strong>Área de segurança:</strong> deixe uma folga nas bordas; o
            que ficar fora do círculo é cortado.
          </li>
          <li>
            <strong>Peso:</strong> até ~1 MB (o sistema já otimiza no envio).
          </li>
        </ul>
      </div>

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
                  <p className="select-all font-mono text-[11px] text-slate-400" title="Cor do nível — use ao pedir a arte">
                    {b.color.toUpperCase()}
                  </p>
                </div>
              </div>
              <ImageUpload
                name={`icon_${b.level}`}
                label="Arte do nível"
                hint="PNG/SVG quadrado. Vazio = usa o emoji."
                defaultValue={icons.get(b.level) ?? ""}
                slot={`nivel-${b.level}`}
                aspect="1 / 1"
                round
                maxW={1024}
                maxH={1024}
              />
            </div>
          ))}
        </div>
        <SubmitButton pendingText="Salvando…">Salvar ícones</SubmitButton>
      </form>
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { updateGamificationSettings, saveLevelIcons } from "@/lib/actions/admin";
import { LEVEL_BADGES } from "@/lib/levelBadges";
import { getLevelIconMap } from "@/lib/levelIcons";
import SubmitButton from "@/components/SubmitButton";
import ImageUpload from "@/components/ImageUpload";

// Onda 3 · Navegação — Gamificação em um só lugar: ativar/ranking (por
// universidade) e, para a Weedu, a personalização dos ícones dos níveis.
export default async function GamificacaoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const isSuper = user.role === "SUPER_ADMIN";
  const icons = isSuper ? await getLevelIconMap() : null;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gamificação</h1>
        <p className="text-sm text-slate-500">
          XP, níveis, conquistas e ofensiva no painel do aluno.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Ativação + ranking (por universidade) */}
        <div className="card">
          <h2 className="mb-1 font-semibold">Ativação</h2>
          <p className="mb-4 text-xs text-slate-500">
            O ranking mostra o nome dos alunos — desligue se preferir manter privado.
          </p>
          {user.tenant.gamificationEntitled ? (
            <form action={updateGamificationSettings} className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                <input
                  type="checkbox"
                  name="gamificationEnabled"
                  defaultChecked={user.tenant.gamificationEnabled}
                  className="h-4 w-4"
                />
                <span>
                  <span className="font-medium">Ativar gamificação</span>
                  <span className="block text-xs text-slate-400">
                    XP, níveis, conquistas e ofensiva.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                <input
                  type="checkbox"
                  name="rankingEnabled"
                  defaultChecked={user.tenant.rankingEnabled}
                  className="h-4 w-4"
                />
                <span>
                  <span className="font-medium">Mostrar ranking da turma</span>
                  <span className="block text-xs text-slate-400">
                    Placar por XP com nomes dos alunos.
                  </span>
                </span>
              </label>
              <SubmitButton pendingText="Salvando…">Salvar gamificação</SubmitButton>
            </form>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
              🔒 O módulo de gamificação não está liberado para esta universidade.
              Fale com a Weedu para habilitar.
            </p>
          )}
        </div>

        {/* Ícones dos níveis (global da Weedu — só SUPER_ADMIN) */}
        {isSuper && icons && (
          <div className="card">
            <h2 className="mb-1 font-semibold">Ícones dos níveis</h2>
            <p className="mb-4 text-sm text-slate-500">
              A arte é exibida <strong>redonda</strong> (formato de boton). Sem arte
              cadastrada, a plataforma usa o emoji padrão do nível. Vale para a Weedu e
              todas as filhas.
            </p>

            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
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
              <div className="grid gap-5 sm:grid-cols-2">
                {LEVEL_BADGES.map((b) => (
                  <div key={b.level} className="rounded-xl border border-slate-200 p-4">
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
          </div>
        )}
      </div>
    </>
  );
}

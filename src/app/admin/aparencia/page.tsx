import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  updateBranding,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  moveHeroSlide,
} from "@/lib/actions/admin";
import SubmitButton from "@/components/SubmitButton";
import ImageUpload from "@/components/ImageUpload";

// Onda 3 · Navegação — página dedicada de Aparência: identidade visual
// (cores, logo, tema, certificado) + banner de entrada + banner rotativo da
// home. Movido do painel único de administração para organizar o visual.

// Linha de edição de um bloco de texto do login: texto + cor + negrito/itálico.
function LoginTextRow({
  label,
  name,
  placeholder,
  value,
  color,
  bold,
  italic,
  baseColor,
  multiline = false,
}: {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  color: string | null;
  bold: boolean;
  italic: boolean;
  baseColor: string;
  multiline?: boolean;
}) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-slate-600" title="Cor deste bloco">
            <input type="color" name={`${name}Color`} defaultValue={color ?? baseColor} className="h-7 w-9 rounded border border-slate-300" />
          </label>
          <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
            <input type="checkbox" name={`${name}Bold`} defaultChecked={bold} className="h-3.5 w-3.5" /> N
          </label>
          <label className="flex items-center gap-1 text-xs italic text-slate-600">
            <input type="checkbox" name={`${name}Italic`} defaultChecked={italic} className="h-3.5 w-3.5" /> I
          </label>
        </div>
      </div>
      {multiline ? (
        <textarea name={name} defaultValue={value} className="input py-1.5 text-sm" rows={2} placeholder={placeholder} />
      ) : (
        <input name={name} defaultValue={value} className="input py-1.5 text-sm" placeholder={placeholder} />
      )}
    </div>
  );
}

export default async function AparenciaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const heroSlides = await prisma.heroSlide.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Aparência</h1>
        <p className="text-sm text-slate-500">
          Identidade visual da sua universidade: cores, logo, tema, banners e certificado.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identidade visual */}
        <div className="card">
          <h2 className="mb-4 font-semibold">Identidade visual</h2>
          <form action={updateBranding} className="space-y-3">
            <div>
              <label className="label">Cor principal</label>
              <input name="brandColor" type="color" defaultValue={user.tenant.brandColor} className="h-10 w-full rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="label">Cor do texto sobre a cor principal</label>
              <input name="brandFgColor" type="color" defaultValue={user.tenant.brandFgColor} className="h-10 w-full rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="label">Tema da área do aluno</label>
              <p className="-mt-1 mb-2 text-xs text-slate-500">
                Escuro = imersivo estilo streaming. Claro = fundo branco.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "dark", t: "Escuro", desc: "Netflix/Prime" },
                  { v: "light", t: "Claro", desc: "Fundo branco" },
                ].map((o) => (
                  <label
                    key={o.v}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={o.v}
                      defaultChecked={(user.tenant.theme ?? "dark") === o.v}
                    />
                    <span>
                      <span className="font-medium">{o.t}</span>
                      <span className="block text-xs text-slate-400">{o.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <ImageUpload
              name="logoUrl"
              label="Logo"
              hint="PNG com fundo transparente · altura ~64px · até 400×120px."
              defaultValue={user.tenant.logoUrl ?? ""}
              slot="logo"
              aspect="3 / 1"
            />
            <ImageUpload
              name="bannerUrl"
              label="Banner de entrada (home)"
              hint="16:9 · recomendado 1600×900px (mín. 1280×720) · JPG/WebP."
              defaultValue={user.tenant.bannerUrl ?? ""}
              slot="banner"
              aspect="16 / 9"
            />
            <ImageUpload
              name="certificateBg"
              label="Fundo do certificado"
              hint="A4 paisagem · 3508×2480px (300dpi) · PNG/JPG."
              defaultValue={user.tenant.certificateBg ?? ""}
              slot="certificado"
              aspect="1.414 / 1"
            />
            <input name="certificateSignature" defaultValue={user.tenant.certificateSignature ?? ""} className="input" placeholder="Assinatura do certificado" />

            {/* Tela de login (personalização por universidade) */}
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-1 text-sm font-semibold">Tela de login</p>
              <p className="mb-3 text-xs text-slate-500">
                Personalize o painel da tela de entrada. Cada bloco tem cor, negrito
                e itálico próprios; em branco, usa o padrão.
              </p>
              <ImageUpload
                name="loginBgUrl"
                label="Imagem de fundo do login"
                hint="Retrato/paisagem · recomendado 1200×1600px · JPG/WebP. Sem imagem, usa o degradê da marca."
                defaultValue={user.tenant.loginBgUrl ?? ""}
                slot="login"
                aspect="3 / 4"
              />

              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                <input type="checkbox" name="loginHideText" defaultChecked={user.tenant.loginHideText} className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="font-medium">Usar só a imagem (esconder textos)</span>
                  <span className="block text-xs text-slate-400">
                    Para subir uma arte completa com os textos já embutidos. Oculta rótulo, título, subtítulo e logo.
                  </span>
                </span>
              </label>

              {/* Cor base (usada quando o bloco não tem cor própria) */}
              <div className="mt-3 flex items-center gap-2">
                <label className="label mb-0 text-xs">Cor base dos textos</label>
                <input name="loginTextColor" type="color" defaultValue={user.tenant.loginTextColor ?? "#ffffff"} className="h-9 w-14 rounded border border-slate-300" />
                <span className="text-xs text-slate-400">Tom claro sobre fundos escuros.</span>
              </div>

              {/* Rótulo */}
              <LoginTextRow
                label="Rótulo"
                name="loginEyebrow"
                placeholder="Ex.: Universidade corporativa"
                value={user.tenant.loginEyebrow ?? ""}
                color={user.tenant.loginEyebrowColor}
                bold={user.tenant.loginEyebrowBold}
                italic={user.tenant.loginEyebrowItalic}
                baseColor={user.tenant.loginTextColor ?? "#ffffff"}
              />
              {/* Título */}
              <LoginTextRow
                label="Título"
                name="loginTitle"
                placeholder="Ex.: Conhecimento que vira resultado."
                value={user.tenant.loginTitle ?? ""}
                color={user.tenant.loginTitleColor}
                bold={user.tenant.loginTitleBold}
                italic={user.tenant.loginTitleItalic}
                baseColor={user.tenant.loginTextColor ?? "#ffffff"}
              />
              {/* Subtítulo */}
              <LoginTextRow
                label="Subtítulo"
                name="loginSubtitle"
                placeholder="Texto abaixo do título"
                value={user.tenant.loginSubtitle ?? ""}
                color={user.tenant.loginSubtitleColor}
                bold={user.tenant.loginSubtitleBold}
                italic={user.tenant.loginSubtitleItalic}
                baseColor={user.tenant.loginTextColor ?? "#ffffff"}
                multiline
              />
            </div>

            <SubmitButton pendingText="Salvando…">Salvar aparência</SubmitButton>
          </form>
        </div>

        {/* Banner rotativo da home (hero) */}
        <div className="card">
          <h2 className="mb-1 font-semibold">Banner rotativo da home</h2>
          <p className="mb-4 text-xs text-slate-500">
            Slides que giram no topo da home do aluno. Imagem + texto e link
            opcionais. Recomendado 1600×900px (16:9).
          </p>

          {heroSlides.length > 0 && (
            <ul className="mb-4 space-y-3">
              {heroSlides.map((s, idx) => (
                <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt=""
                      className="h-14 w-24 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.title || <span className="text-slate-400">(sem título)</span>}
                        {!s.active && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            oculto
                          </span>
                        )}
                      </p>
                      {s.subtitle && <p className="truncate text-xs text-slate-500">{s.subtitle}</p>}
                      {s.ctaHref && (
                        <p className="truncate text-xs text-brand">
                          {s.ctaLabel ? `${s.ctaLabel} → ` : "→ "}
                          {s.ctaHref}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className="flex gap-1">
                        <form action={moveHeroSlide.bind(null, s.id, "up")}>
                          <button className="rounded border border-slate-200 px-1.5 text-xs disabled:opacity-30" disabled={idx === 0} type="submit">↑</button>
                        </form>
                        <form action={moveHeroSlide.bind(null, s.id, "down")}>
                          <button className="rounded border border-slate-200 px-1.5 text-xs disabled:opacity-30" disabled={idx === heroSlides.length - 1} type="submit">↓</button>
                        </form>
                        <form action={deleteHeroSlide.bind(null, s.id)}>
                          <button className="rounded border border-slate-200 px-1.5 text-xs text-red-500" type="submit">remover</button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Editar slide */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-500">editar</summary>
                    <form action={updateHeroSlide.bind(null, s.id)} className="mt-2 space-y-2">
                      <ImageUpload
                        name="imageUrl"
                        label="Imagem do slide"
                        hint="16:9 · 1600×900px · JPG/WebP."
                        defaultValue={s.imageUrl}
                        slot="hero"
                        aspect="16 / 9"
                      />
                      <input name="title" defaultValue={s.title ?? ""} className="input" placeholder="Título (opcional)" />
                      <input name="subtitle" defaultValue={s.subtitle ?? ""} className="input" placeholder="Subtítulo (opcional)" />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="ctaLabel" defaultValue={s.ctaLabel ?? ""} className="input" placeholder="Texto do botão" />
                        <input name="ctaHref" defaultValue={s.ctaHref ?? ""} className="input" placeholder="Link (ex.: /vitrines/... ou https://)" />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" name="active" defaultChecked={s.active} /> Ativo (visível na home)
                      </label>
                      <SubmitButton pendingText="Salvando…">Salvar slide</SubmitButton>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}

          {/* Novo slide */}
          <form action={createHeroSlide} className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium">Novo slide</p>
            <ImageUpload
              name="imageUrl"
              label="Imagem do slide"
              hint="16:9 · 1600×900px · JPG/WebP."
              slot="hero"
              aspect="16 / 9"
            />
            <input name="title" className="input" placeholder="Título (opcional)" />
            <input name="subtitle" className="input" placeholder="Subtítulo (opcional)" />
            <div className="grid grid-cols-2 gap-2">
              <input name="ctaLabel" className="input" placeholder="Texto do botão (opcional)" />
              <input name="ctaHref" className="input" placeholder="Link (ex.: /vitrines/ID ou https://)" />
            </div>
            <SubmitButton pendingText="Adicionando…">+ Adicionar slide</SubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}

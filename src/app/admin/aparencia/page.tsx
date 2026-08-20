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

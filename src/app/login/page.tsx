import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const isPreview = preview != null;
  const user = await getCurrentUser();
  // Modo pré-visualização (para o admin ver a tela de login sem deslogar):
  // não redireciona e usa o tenant que ele está editando. Fora do preview,
  // quem já está logado vai para o painel normalmente.
  if (user && !isPreview) redirect("/dashboard");
  if (user && isPreview && !isAdmin(user.role)) redirect("/dashboard");

  const tenant = isPreview && user ? user.tenant : await resolveTenant();
  const name = tenant?.name ?? "Universidade";

  // Personalização da tela de login (com padrões quando vazio).
  const hideText = !!tenant?.loginHideText;
  const loginTitle = tenant?.loginTitle?.trim();
  const loginSubtitle =
    tenant?.loginSubtitle?.trim() ||
    "Trilhas de treinamento, avaliações e certificados — no seu ritmo, com um professor virtual pronto para tirar suas dúvidas.";
  const loginEyebrow = tenant?.loginEyebrow?.trim() || "Universidade corporativa";
  const baseColor = tenant?.loginTextColor?.trim() || "#ffffff";
  const bgUrl = tenant?.loginBgUrl?.trim();

  // Estilo por bloco: cor própria (ou a base) + negrito/itálico.
  const eyebrowStyle = {
    color: tenant?.loginEyebrowColor?.trim() || baseColor,
    opacity: 0.7,
    fontWeight: tenant?.loginEyebrowBold ? 700 : undefined,
    fontStyle: tenant?.loginEyebrowItalic ? "italic" : undefined,
  } as const;
  const titleStyle = {
    color: tenant?.loginTitleColor?.trim() || baseColor,
    fontStyle: tenant?.loginTitleItalic ? "italic" : undefined,
  } as const;
  const subtitleStyle = {
    color: tenant?.loginSubtitleColor?.trim() || baseColor,
    opacity: 0.8,
    fontWeight: tenant?.loginSubtitleBold ? 700 : undefined,
    fontStyle: tenant?.loginSubtitleItalic ? "italic" : undefined,
  } as const;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {isPreview && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
          Pré-visualização · esta é a tela que seus alunos veem
        </div>
      )}
      {/* Painel imersivo: imagem de fundo (se houver) sobre o gradiente da marca */}
      <section className="brand-immersive relative hidden flex-col justify-between p-12 lg:flex">
        {bgUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {/* Sem "só imagem", escurece um pouco para o texto ficar legível. */}
            {!hideText && <div className="absolute inset-0 bg-black/45" />}
          </>
        )}

        {/* Modo "só imagem": a arte de fundo já traz tudo — nada é sobreposto. */}
        {!hideText && (
          <>
            <div className="relative flex items-center gap-3">
              {tenant?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt={name} className="h-9 object-contain" />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black"
                  style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
                >
                  {name.charAt(0)}
                </div>
              )}
              <span className="text-lg font-bold" style={{ color: baseColor }}>{name}</span>
            </div>

            <div className="relative max-w-md">
              <p className="eyebrow" style={eyebrowStyle}>{loginEyebrow}</p>
              {loginTitle ? (
                <h1 className="mt-3 text-4xl font-black leading-tight" style={titleStyle}>{loginTitle}</h1>
              ) : (
                <h1 className="mt-3 text-4xl font-black leading-tight" style={titleStyle}>
                  Conhecimento que vira{" "}
                  <span style={{ color: "var(--brand-color)" }}>resultado</span>.
                </h1>
              )}
              <p className="mt-4" style={subtitleStyle}>
                {loginSubtitle}
              </p>
            </div>

            <p className="relative text-sm" style={{ color: baseColor, opacity: 0.4 }}>
              Powered by Weedu · Gestão de Resultados
            </p>
          </>
        )}
      </section>

      {/* Formulário */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-black"
              style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
            >
              {name.charAt(0)}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-ink">Bem-vindo de volta</h2>
          <p className="mt-1 text-sm text-slate-500">Acesse seus treinamentos.</p>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}

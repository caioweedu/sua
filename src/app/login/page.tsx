import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const tenant = await resolveTenant();
  const name = tenant?.name ?? "Universidade";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Painel imersivo com a cor do tenant */}
      <section className="brand-immersive relative hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
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
          <span className="text-lg font-bold">{name}</span>
        </div>

        <div className="max-w-md">
          <p className="eyebrow text-white/50">Universidade corporativa</p>
          <h1 className="mt-3 text-4xl font-black leading-tight">
            Conhecimento que vira{" "}
            <span style={{ color: "var(--brand-color)" }}>resultado</span>.
          </h1>
          <p className="mt-4 text-white/70">
            Trilhas de treinamento, avaliações e certificados — no seu ritmo, com
            um professor virtual pronto para tirar suas dúvidas.
          </p>
        </div>

        <p className="text-sm text-white/40">
          Powered by Weedu · Gestão de Resultados
        </p>
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

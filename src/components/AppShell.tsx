import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { isAdmin } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
  user: { name: string; role: string; impersonating?: boolean };
  tenant: { name: string; logoUrl: string | null };
  fluid?: boolean;
  /** Área do aluno imersiva (estilo streaming). Combinada com `light` decide o tema. */
  dark?: boolean;
  /** Quando `dark`, usa a variante clara (fundo branco) da área do aluno. */
  light?: boolean;
};

function Brand({ tenant }: { tenant: { name: string; logoUrl: string | null } }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      {tenant.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.logoUrl} alt={tenant.name} className="h-8 object-contain" />
      ) : (
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black"
          style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
        >
          {tenant.name.charAt(0)}
        </div>
      )}
      <span className="text-[15px] font-bold text-ink">{tenant.name}</span>
    </Link>
  );
}

export default function AppShell({ children, user, tenant, fluid, dark, light }: Props) {
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // Área do aluno em tema escuro imersivo: só quando `dark` e não `light`.
  const immersiveDark = !!dark && !light;

  const headerCls = immersiveDark
    ? "sticky top-0 z-30 border-b border-white/10 bg-[#0b0b12]/80 backdrop-blur"
    : "sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur";
  const ghostCls = immersiveDark
    ? "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
    : "btn-ghost";

  // Raiz da área do aluno: publica as variáveis de tema (.stage / .stage.light).
  const rootCls = dark
    ? `stage min-h-screen${light ? " light" : ""}`
    : "min-h-screen";

  return (
    <div className={rootCls} style={dark ? { background: "var(--page-bg)", color: "var(--s-fg)" } : undefined}>
      <header className={headerCls}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              {tenant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt={tenant.name} className="h-8 object-contain" />
              ) : (
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black"
                  style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
                >
                  {tenant.name.charAt(0)}
                </div>
              )}
              <span className={`text-[15px] font-bold ${immersiveDark ? "text-white" : "text-ink"}`}>{tenant.name}</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/dashboard" className={ghostCls}>
                Meus treinamentos
              </Link>
              {isAdmin(user.role) && (
                <Link href="/admin" className={ghostCls}>
                  Administração
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className={`text-sm font-semibold leading-tight ${immersiveDark ? "text-white" : "text-ink"}`}>{user.name}</div>
              <div className={immersiveDark ? "text-xs text-white/50" : "text-xs text-slate-400"}>
                {user.role === "STUDENT" ? "Aluno" : "Administrador"}
              </div>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: "rgb(var(--brand-rgb) / 0.18)", color: immersiveDark ? "var(--brand-fg)" : "var(--brand-color)" }}
            >
              {initials}
            </div>
            <form action={logoutAction}>
              <button className={`${ghostCls} ${immersiveDark ? "hover:text-red-400" : "text-slate-400 hover:text-red-600"}`} type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {user.impersonating && (
        <div className="border-b border-amber-300 bg-amber-100 text-amber-900">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <span>
              👁️ Você está visualizando como <strong>{tenant.name}</strong> (universidade filha).
              O que você fizer aqui afeta esta filha.
            </span>
            <a href="/admin?tenant=" className="font-semibold underline hover:no-underline">
              Voltar para a Weedu →
            </a>
          </div>
        </div>
      )}

      <main className={fluid ? "" : "mx-auto max-w-6xl px-4 py-8"}>{children}</main>
    </div>
  );
}

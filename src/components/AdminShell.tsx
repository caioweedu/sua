import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import AdminSidebar from "./AdminSidebar";

// Onda 3 · Casca da administração — cabeçalho enxuto + sidebar lateral
// recolhível (AdminSidebar) + conteúdo. Substitui o AppShell nas telas de
// admin, deixando a navegação na lateral em vez de botões soltos no topo.

type Props = {
  children: React.ReactNode;
  user: { name: string; role: string; impersonating?: boolean };
  tenant: { name: string; logoUrl: string | null };
  fluid?: boolean;
};

export default function AdminShell({ children, user, tenant, fluid }: Props) {
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const isSuper = user.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5">
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
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
              Ver como aluno
            </Link>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight text-ink">{user.name}</div>
              <div className="text-xs text-slate-400">
                {isSuper ? "Weedu (super admin)" : "Administrador"}
              </div>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: "rgb(var(--brand-rgb) / 0.18)", color: "var(--brand-color)" }}
            >
              {initials}
            </div>
            <form action={logoutAction}>
              <button className="btn-ghost text-slate-400 hover:text-red-600" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {user.impersonating && (
        <div className="border-b border-amber-300 bg-amber-100 text-amber-900">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
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

      <div className="flex flex-col md:flex-row">
        <AdminSidebar isSuper={isSuper} />
        <main className={`min-w-0 flex-1 ${fluid ? "" : "px-4 py-8 md:px-8"}`}>
          <div className={fluid ? "" : "mx-auto max-w-5xl"}>{children}</div>
        </main>
      </div>
    </div>
  );
}

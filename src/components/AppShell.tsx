import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { isAdmin } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
  user: { name: string; role: string };
  tenant: { name: string; logoUrl: string | null };
  fluid?: boolean;
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

export default function AppShell({ children, user, tenant, fluid }: Props) {
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Brand tenant={tenant} />
            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/dashboard" className="btn-ghost">
                Meus treinamentos
              </Link>
              {isAdmin(user.role) && (
                <Link href="/admin" className="btn-ghost">
                  Administração
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight text-ink">{user.name}</div>
              <div className="text-xs text-slate-400">
                {user.role === "STUDENT" ? "Aluno" : "Administrador"}
              </div>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: "rgb(var(--brand-rgb) / 0.12)", color: "var(--brand-color)" }}
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

      <main className={fluid ? "" : "mx-auto max-w-6xl px-4 py-8"}>{children}</main>
    </div>
  );
}

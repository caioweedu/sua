import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { isAdmin } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
  user: { name: string; role: string };
  tenant: { name: string; logoUrl: string | null };
};

export default function AppShell({ children, user, tenant }: Props) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={tenant.name} className="h-8 object-contain" />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg font-bold"
                style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
              >
                {tenant.name.charAt(0)}
              </div>
            )}
            <Link href="/dashboard" className="font-semibold">
              {tenant.name}
            </Link>
          </div>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Meus treinamentos
            </Link>
            {isAdmin(user.role) && (
              <Link href="/admin" className="text-slate-600 hover:text-slate-900">
                Administração
              </Link>
            )}
            <span className="hidden text-slate-400 sm:inline">·</span>
            <span className="hidden text-slate-600 sm:inline">{user.name}</span>
            <form action={logoutAction}>
              <button className="text-slate-500 hover:text-red-600" type="submit">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/lib/actions/auth";

// Onda 3 · Navegação do admin — sidebar lateral recolhível.
// A seção atual fica destacada na cor principal (var(--brand-color)); as demais
// ficam brancas. Recolhe para só ícones (persistido em localStorage). Rodapé
// com o usuário e "Sair". Em telas pequenas vira uma barra horizontal rolável.

type Item = {
  href: string;
  icon: string;
  label: string;
  // Prefixos de rota que mantêm este item ativo (além do próprio href).
  match: string[];
  superOnly?: boolean;
};

const ITEMS: Item[] = [
  { href: "/admin/analytics", icon: "📊", label: "Dashboard", match: [] },
  { href: "/admin", icon: "📚", label: "Conteúdo", match: ["/admin/trilhas", "/admin/copiloto"] },
  { href: "/admin/usuarios", icon: "👥", label: "Usuários", match: ["/admin/alunos"] },
  {
    href: "/admin/rh",
    icon: "🧑‍💼",
    label: "Painel Gestor",
    match: ["/admin/equipes", "/admin/planejamento"],
  },
  { href: "/admin/aparencia", icon: "🎨", label: "Aparência", match: [] },
  { href: "/admin/gamificacao", icon: "🎮", label: "Gamificação", match: [] },
  { href: "/admin/provas", icon: "📝", label: "Provas", match: [] },
  { href: "/admin/certificados", icon: "🏆", label: "Certificados", match: [] },
  { href: "/admin/filhas", icon: "🏢", label: "Filhas", match: [], superOnly: true },
];

function isActive(item: Item, pathname: string): boolean {
  if (item.href === "/admin") {
    // "Conteúdo" só fica ativo na raiz ou nas sub-rotas declaradas (não em
    // /admin/usuarios etc., que começam com "/admin/").
    if (pathname === "/admin") return true;
    return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  }
  if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
  return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

export default function AdminSidebar({
  isSuper,
  user,
}: {
  isSuper: boolean;
  user: { name: string; email?: string };
}) {
  const pathname = usePathname() ?? "/admin";
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  // Restaura a preferência de recolhido (só no cliente, para não brigar com o SSR).
  useEffect(() => {
    setCollapsed(localStorage.getItem("adminSidebarCollapsed") === "1");
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("adminSidebarCollapsed", next ? "1" : "0");
      return next;
    });
  }

  const items = ITEMS.filter((it) => !it.superOnly || isSuper);
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Desktop — sidebar vertical recolhível */}
      <aside
        className={`sticky top-[61px] hidden h-[calc(100vh-61px)] shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 md:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
        style={{ visibility: ready ? "visible" : "hidden" }}
      >
        {/* Recolher / expandir */}
        <div className={`flex items-center px-3 pt-3 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Menu Principal
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {/* ícone de painel */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {items.map((it) => {
            const active = isActive(it, pathname);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? it.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  collapsed ? "justify-center" : ""
                } ${active ? "shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`}
                style={
                  active
                    ? { background: "var(--brand-color)", color: "var(--brand-fg)" }
                    : undefined
                }
              >
                <span className="text-base leading-none">{it.icon}</span>
                {!collapsed && <span className="truncate">{it.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé — usuário + sair */}
        <div className="border-t border-slate-100 p-2">
          <div className={`flex items-center gap-2.5 rounded-xl px-2 py-2 ${collapsed ? "justify-center" : ""}`}>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "rgb(var(--brand-rgb) / 0.18)", color: "var(--brand-color)" }}
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                {user.email && <p className="truncate text-xs text-slate-400">{user.email}</p>}
              </div>
            )}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 ${
                collapsed ? "justify-center" : ""
              }`}
              title="Sair do sistema"
            >
              <span aria-hidden>⎋</span>
              {!collapsed && <span>Sair do Sistema</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile — barra horizontal rolável */}
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
        {items.map((it) => {
          const active = isActive(it, pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active ? "" : "text-slate-600 hover:bg-slate-100"
              }`}
              style={
                active ? { background: "var(--brand-color)", color: "var(--brand-fg)" } : undefined
              }
            >
              <span>{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

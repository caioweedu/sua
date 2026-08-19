"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Onda 3 · Navegação do admin — sidebar lateral recolhível.
// A seção atual fica destacada na cor principal (var(--brand-color)); as demais
// ficam brancas. Recolhe para só ícones (persistido em localStorage). Em telas
// pequenas vira uma barra horizontal rolável.

type Item = {
  href: string;
  icon: string;
  label: string;
  // Prefixos de rota que mantêm este item ativo (além do próprio href).
  match: string[];
  superOnly?: boolean;
};

const ITEMS: Item[] = [
  { href: "/admin", icon: "📚", label: "Conteúdo", match: ["/admin/trilhas"] },
  { href: "/admin/usuarios", icon: "👥", label: "Usuários", match: ["/admin/alunos"] },
  { href: "/admin/aparencia", icon: "🎨", label: "Aparência", match: ["/admin/niveis"] },
  {
    href: "/admin/rh",
    icon: "🧑‍💼",
    label: "Painel Gestor",
    match: ["/admin/analytics", "/admin/equipes", "/admin/planejamento"],
  },
  { href: "/admin/provas", icon: "📝", label: "Provas", match: [] },
  { href: "/admin/certificados", icon: "🏆", label: "Certificados", match: [] },
  { href: "/admin/copiloto", icon: "✨", label: "Copiloto", match: [] },
];

function isActive(item: Item, pathname: string): boolean {
  if (item.href === "/admin") {
    // "Conteúdo" só fica ativo na raiz ou nas sub-rotas declaradas (não em
    // /admin/usuarios etc., que começam com "/admin/").
    if (pathname === "/admin") return true;
    return item.match.some((m) => pathname.startsWith(m));
  }
  if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
  return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

export default function AdminSidebar({ isSuper: _isSuper }: { isSuper: boolean }) {
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

  const items = ITEMS; // (superOnly reservado para itens futuros da Weedu)

  return (
    <>
      {/* Desktop — sidebar vertical recolhível */}
      <aside
        className={`sticky top-[61px] hidden h-[calc(100vh-61px)] shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 md:flex md:flex-col ${
          collapsed ? "w-16" : "w-56"
        }`}
        style={{ visibility: ready ? "visible" : "hidden" }}
      >
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
        <button
          type="button"
          onClick={toggle}
          className="m-2 flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <span>{collapsed ? "»" : "«"}</span>
          {!collapsed && <span>Recolher</span>}
        </button>
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

import Link from "next/link";

// Barra de navegação do Painel Gestor (RH/gestão): agrupa Painel, Planejamento,
// Equipes e Resultados. A aba atual fica na cor principal (btn-brand); as demais
// ficam brancas (btn-outline). Passe `active` com a chave da página.
const TABS = [
  { key: "rh", label: "🧭 Visão geral", href: "/admin/rh" },
  { key: "planejamento", label: "🗓️ Planejamento", href: "/admin/planejamento" },
  { key: "equipes", label: "🏢 Equipes", href: "/admin/equipes" },
  { key: "analytics", label: "📊 Resultados", href: "/admin/analytics" },
] as const;

export type GestorTab = (typeof TABS)[number]["key"];

export default function GestorNav({ active }: { active: GestorTab }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`${t.key === active ? "btn-brand" : "btn-outline"} text-sm`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

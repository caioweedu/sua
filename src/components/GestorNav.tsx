import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";

// Barra de navegação do Painel Gestor (RH/gestão): agrupa Painel, Planejamento,
// Equipes e Resultados. A aba atual fica na cor principal (btn-brand); as demais
// ficam brancas (btn-outline). Passe `active` com a chave da página.
const TABS: { key: string; label: string; href: string; icon: IconName }[] = [
  { key: "rh", label: "Visão geral", href: "/admin/rh", icon: "gauge" },
  { key: "planejamento", label: "Planejamento", href: "/admin/planejamento", icon: "calendar" },
  { key: "compliance", label: "Compliance", href: "/admin/compliance", icon: "shieldCheck" },
  { key: "equipes", label: "Equipes", href: "/admin/equipes", icon: "network" },
];

export type GestorTab = (typeof TABS)[number]["key"];

export default function GestorNav({ active }: { active: GestorTab }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`${t.key === active ? "btn-brand" : "btn-outline"} inline-flex items-center gap-2 text-sm`}
        >
          <Icon name={t.icon} size={16} className="shrink-0" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

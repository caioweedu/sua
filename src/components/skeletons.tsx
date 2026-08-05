// Peças reutilizáveis de skeleton loader. Cada loading.tsx compõe estas peças.
// O container externo usa a classe `.sk` (aparece só após ~0.8s) para não
// piscar em cargas rápidas.

export function Bar({ className = "" }: { className?: string }) {
  return <div className={`sk-box ${className}`} aria-hidden />;
}

// Cabeçalho (imita o AppShell) para manter continuidade durante a navegação.
export function SkTopbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <Bar className="h-9 w-9 rounded-xl" />
            <Bar className="h-4 w-28" />
          </div>
          <div className="hidden gap-3 md:flex">
            <Bar className="h-4 w-32" />
            <Bar className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Bar className="hidden h-8 w-24 sm:block" />
          <Bar className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </header>
  );
}

// Casca de página: topbar + main com largura padrão. `fluid` remove o container.
export function SkShell({
  children,
  fluid = false,
}: {
  children: React.ReactNode;
  fluid?: boolean;
}) {
  return (
    <div className="sk min-h-screen" role="status" aria-label="Carregando…">
      <SkTopbar />
      <main className={fluid ? "" : "mx-auto max-w-6xl px-4 py-8"}>{children}</main>
    </div>
  );
}

// Cartão de curso/vitrine (grade).
export function SkCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <Bar className="h-36 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Bar className="h-4 w-3/4" />
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-2/3" />
        <Bar className="mt-3 h-9 w-full" />
      </div>
    </div>
  );
}

export function SkCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkCard key={i} />
      ))}
    </div>
  );
}

// Indicador global de navegação. O App Router mostra este fallback enquanto a
// próxima tela (server component) está carregando — dá o retorno visual de que
// a plataforma "está pensando" após um clique.
export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/70 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200"
        style={{ borderTopColor: "var(--brand-color)" }}
        aria-hidden
      />
      <span className="text-sm font-medium text-slate-500">Carregando…</span>
    </div>
  );
}

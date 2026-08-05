import Link from "next/link";

// Fileira horizontal estilo streaming: título (opcional com link) + trilha de
// cartões que rola na horizontal.
export default function Row({
  title,
  href,
  hrefLabel = "Ver tudo",
  locked,
  note,
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  locked?: boolean;
  note?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            {locked && <span className="text-sm">🔒</span>}
            {title}
          </h2>
          {note && <p className="mt-0.5 text-xs text-amber-300/80">{note}</p>}
        </div>
        {href && !locked && (
          <Link href={href} className="shrink-0 text-xs font-medium text-white/60 transition hover:text-white">
            {hrefLabel} →
          </Link>
        )}
      </div>
      <div className="row-scroll flex gap-3 overflow-x-auto px-4 pb-2">{children}</div>
    </section>
  );
}

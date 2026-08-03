import Link from "next/link";
import { coverFor, iconFor } from "@/lib/cover";

type Props = {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  produtos: number;
};

export default function VitrineCard({ id, name, description, coverUrl, produtos }: Props) {
  const { c1, c2 } = coverFor(name);
  return (
    <Link
      href={`/vitrines/${id}`}
      className="group relative block overflow-hidden rounded-2xl border border-slate-200 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div
        className="relative flex h-48 flex-col justify-end p-5 text-white"
        style={
          coverUrl
            ? { background: `url(${coverUrl}) center/cover` }
            : ({ ["--c1" as string]: c1, ["--c2" as string]: c2 } as React.CSSProperties)
        }
      >
        {!coverUrl && <div className="cover-gradient absolute inset-0" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <span className="absolute right-4 top-4 text-3xl drop-shadow">{iconFor(name)}</span>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Vitrine</p>
          <h3 className="mt-1 text-xl font-black drop-shadow-sm">{name}</h3>
          {description && (
            <p className="mt-1 line-clamp-1 text-sm text-white/80">{description}</p>
          )}
          <p className="mt-2 text-xs text-white/70">
            {produtos} treinamento(s) · <span className="group-hover:underline">Explorar →</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

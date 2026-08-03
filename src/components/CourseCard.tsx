import Link from "next/link";
import { coverFor, iconFor } from "@/lib/cover";

type Props = {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  aulas: number;
  done?: boolean;
  hasCert?: boolean;
  progress?: number; // 0-100
};

export default function CourseCard({
  id,
  title,
  description,
  coverUrl,
  aulas,
  done,
  hasCert,
  progress = 0,
}: Props) {
  const { c1, c2 } = coverFor(title);

  return (
    <Link
      href={`/trilhas/${id}`}
      className="group block w-[280px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div
        className="relative flex h-36 items-end p-4 text-white"
        style={
          coverUrl
            ? { background: `url(${coverUrl}) center/cover` }
            : ({ ["--c1" as string]: c1, ["--c2" as string]: c2 } as React.CSSProperties)
        }
      >
        {!coverUrl && <div className="cover-gradient absolute inset-0" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="absolute right-3 top-3 text-2xl drop-shadow">{iconFor(title)}</span>
        {hasCert && (
          <span className="chip absolute left-3 top-3 bg-amber-400/95 text-amber-950">
            🏆 Certificado
          </span>
        )}
        <h3 className="relative text-base font-bold leading-snug drop-shadow-sm line-clamp-2">
          {title}
        </h3>
      </div>

      <div className="p-4">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-slate-500">
          {description}
        </p>
        <div className="mt-3">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${done ? 100 : progress}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{aulas} aula(s)</span>
            <span className="font-medium text-slate-600 group-hover:text-brand">
              {done ? "Concluída ✓" : progress > 0 ? "Continuar →" : "Começar →"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

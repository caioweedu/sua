import Link from "next/link";
import Image from "next/image";
import { coverFor, iconFor } from "@/lib/cover";

type Props = {
  title: string;
  href?: string; // ausente = bloqueado / não clicável
  coverUrl?: string | null;
  seed?: string;
  subtitle?: string | null;
  done?: boolean;
  hasCert?: boolean;
  progress?: number; // 0-100
  locked?: boolean;
  lockReason?: string | null;
};

// Cartão em formato "pôster" (retrato), estilo streaming. Usado nas fileiras da
// home e das vitrines.
export default function PosterCard({
  title,
  href,
  coverUrl,
  seed,
  subtitle,
  done,
  hasCert,
  progress = 0,
  locked,
  lockReason,
}: Props) {
  const { c1, c2 } = coverFor(seed ?? title);

  const art = (
    <div
      className="relative aspect-[2/3] w-full overflow-hidden rounded-xl"
      style={
        coverUrl
          ? undefined
          : ({ ["--c1" as string]: c1, ["--c2" as string]: c2 } as React.CSSProperties)
      }
    >
      {coverUrl ? (
        // next/image: gera versões responsivas (AVIF/WebP) e faz lazy load,
        // reduzindo muito a banda nas grades de pôsteres.
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 45vw, 168px"
          className="object-cover"
        />
      ) : (
        <div className="cover-gradient absolute inset-0" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

      {/* Selos */}
      {!locked && hasCert && (
        <span className="absolute left-2 top-2 rounded-full bg-amber-400/95 px-2 py-0.5 text-[11px] font-bold text-amber-950">
          🏆
        </span>
      )}
      {locked && (
        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-sm backdrop-blur">
          🔒
        </span>
      )}
      {!coverUrl && (
        <span className="absolute right-2 top-2 text-2xl opacity-80 drop-shadow">{iconFor(seed ?? title)}</span>
      )}

      {/* Texto */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-white/70">{subtitle}</p>}
        {locked && lockReason && (
          <p className="mt-1 line-clamp-2 text-[11px] text-white/60">{lockReason}</p>
        )}
        {!locked && (progress > 0 || done) && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full"
              style={{ width: `${done ? 100 : progress}%`, background: "var(--brand-color)" }}
            />
          </div>
        )}
      </div>
    </div>
  );

  const base = "block w-[150px] shrink-0 sm:w-[168px]";

  if (locked || !href) {
    return (
      <div className={`${base} cursor-not-allowed opacity-60 grayscale`} title={lockReason ?? undefined}>
        {art}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} transition duration-200 hover:z-10 hover:scale-[1.04]`}
    >
      {art}
    </Link>
  );
}

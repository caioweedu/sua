import { SkShell, Bar } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkShell>
      <div className="mx-auto max-w-2xl">
        <Bar className="h-7 w-64 max-w-full" />
        <Bar className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-3">
              <Bar className="h-4 w-3/4" />
              {Array.from({ length: 4 }).map((_, j) => (
                <Bar key={j} className="h-10 w-full" />
              ))}
            </div>
          ))}
          <Bar className="h-11 w-full" />
        </div>
      </div>
    </SkShell>
  );
}

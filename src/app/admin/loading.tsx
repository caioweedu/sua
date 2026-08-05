import { SkShell, Bar } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkShell>
      <div className="mb-6 flex items-center justify-between">
        <Bar className="h-7 w-48" />
        <Bar className="h-8 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card space-y-3">
              <Bar className="h-5 w-32" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Bar key={j} className="h-12 w-full" />
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="card space-y-3">
            <Bar className="h-5 w-28" />
            <Bar className="h-24 w-full" />
          </div>
        </div>
      </div>
    </SkShell>
  );
}

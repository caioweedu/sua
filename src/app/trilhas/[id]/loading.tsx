import { SkShell, Bar } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkShell>
      {/* breadcrumb + título */}
      <Bar className="h-3 w-40" />
      <Bar className="mt-3 h-7 w-72 max-w-full" />
      <Bar className="mt-2 h-4 w-96 max-w-full" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Player + material */}
        <div>
          <Bar className="aspect-video w-full rounded-2xl" />
          <Bar className="mt-4 h-6 w-2/3" />
          <Bar className="mt-2 h-4 w-full" />
          <Bar className="mt-4 h-10 w-48" />
        </div>

        {/* Trilha lateral */}
        <aside>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-3">
              <Bar className="h-4 w-40" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Bar className="h-6 w-6 rounded-full" />
                  <Bar className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
          <div className="card mt-4 space-y-2">
            <Bar className="h-4 w-32" />
            <Bar className="h-9 w-full" />
          </div>
        </aside>
      </div>
    </SkShell>
  );
}

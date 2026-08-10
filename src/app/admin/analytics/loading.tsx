import { SkShell, Bar } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkShell>
      <Bar className="mb-6 h-7 w-40" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card">
            <Bar className="h-3 w-16" />
            <Bar className="mt-2 h-8 w-14" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2"><Bar className="h-40 w-full" /></div>
        <div className="card"><Bar className="h-40 w-full" /></div>
      </div>
      <div className="card mt-6"><Bar className="h-32 w-full" /></div>
    </SkShell>
  );
}

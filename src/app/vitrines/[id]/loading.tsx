import { SkShell, SkCardGrid, Bar } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkShell fluid>
      <section className="relative bg-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Bar className="h-3 w-20 opacity-40" />
          <Bar className="mt-3 h-8 w-72 max-w-full opacity-40" />
          <Bar className="mt-3 h-4 w-96 max-w-full opacity-40" />
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <SkCardGrid count={6} />
      </div>
    </SkShell>
  );
}

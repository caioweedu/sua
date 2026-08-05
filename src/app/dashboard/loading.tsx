import { SkShell, SkCardGrid, Bar } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkShell fluid>
      {/* Hero */}
      <section className="brand-immersive text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <Bar className="h-3 w-24 opacity-40" />
          <Bar className="mt-3 h-8 w-80 max-w-full opacity-40" />
          <Bar className="mt-3 h-4 w-64 max-w-full opacity-40" />
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Bar className="mb-4 h-5 w-28" />
        <SkCardGrid count={6} />
      </div>
    </SkShell>
  );
}

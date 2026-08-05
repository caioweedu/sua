import { SkShell, Bar } from "@/components/skeletons";

// Fallback genérico de navegação (skeleton). Usado por rotas que não têm um
// loading.tsx próprio. Só aparece em cargas acima de ~0.8s (classe .sk).
export default function Loading() {
  return (
    <SkShell>
      <Bar className="mb-6 h-7 w-56" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <Bar className="h-5 w-40" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-5/6" />
            <Bar className="h-9 w-40" />
          </div>
        ))}
      </div>
    </SkShell>
  );
}

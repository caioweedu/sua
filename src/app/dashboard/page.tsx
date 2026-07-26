import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trilhas = await prisma.trilha.findMany({
    where: { tenantId: user.tenantId, published: true },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { aulas: true } },
      enrollments: { where: { userId: user.id } },
      certificates: { where: { userId: user.id } },
    },
  });

  return (
    <AppShell user={user} tenant={user.tenant}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Olá, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-slate-500">Continue seus treinamentos.</p>
      </div>

      {trilhas.length === 0 ? (
        <div className="card text-center text-slate-500">
          Nenhuma trilha publicada ainda.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trilhas.map((t) => {
            const done = t.enrollments[0]?.status === "COMPLETED";
            const hasCert = t.certificates.length > 0;
            return (
              <Link key={t.id} href={`/trilhas/${t.id}`} className="card block transition hover:shadow-md">
                <div
                  className="mb-3 flex h-32 items-center justify-center rounded-lg bg-cover bg-center text-4xl"
                  style={{
                    background: t.coverUrl
                      ? `url(${t.coverUrl}) center/cover`
                      : "linear-gradient(135deg, var(--brand-color), #0f172a)",
                    color: "var(--brand-fg)",
                  }}
                >
                  {!t.coverUrl && "🎓"}
                </div>
                <h3 className="font-semibold">{t.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {t.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                    {t._count.aulas} aula(s)
                  </span>
                  {done && (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">
                      Concluída
                    </span>
                  )}
                  {hasCert && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                      🏆 Certificado
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

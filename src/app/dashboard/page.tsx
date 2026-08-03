import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import CourseCard from "@/components/CourseCard";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trilhas = await prisma.trilha.findMany({
    where: { tenantId: user.tenantId, published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { aulas: true } },
      enrollments: { where: { userId: user.id } },
      certificates: { where: { userId: user.id } },
    },
  });

  const withState = trilhas.map((t) => ({
    ...t,
    done: t.enrollments[0]?.status === "COMPLETED",
    started: t.enrollments.length > 0,
    hasCert: t.certificates.length > 0,
  }));

  const concluidas = withState.filter((t) => t.done).length;
  const certificados = withState.filter((t) => t.hasCert).length;
  const emAndamento = withState.find((t) => t.started && !t.done);
  const proxima = emAndamento ?? withState.find((t) => !t.started);

  // Agrupa por categoria mantendo a ordem de aparição.
  const sections: { name: string; items: typeof withState }[] = [];
  for (const t of withState) {
    const name = t.category?.trim() || "Trilhas";
    const sec = sections.find((s) => s.name === name);
    if (sec) sec.items.push(t);
    else sections.push({ name, items: [t] });
  }

  return (
    <AppShell user={user} tenant={user.tenant} fluid>
      {/* Hero */}
      <section className="brand-immersive text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <p className="eyebrow text-white/50">{user.tenant.name}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Olá, {user.name.split(" ")[0]}. Bora aprender? 👋
          </h1>
          <p className="mt-2 max-w-xl text-white/70">
            {proxima
              ? "Continue de onde parou ou explore novas trilhas."
              : "Suas trilhas aparecerão aqui assim que forem publicadas."}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {proxima && (
              <Link href={`/trilhas/${proxima.id}`} className="btn-brand">
                {emAndamento ? "▶ Continuar treinamento" : "▶ Começar agora"}
              </Link>
            )}
            <div className="flex gap-6 rounded-2xl bg-white/10 px-5 py-3 text-sm backdrop-blur">
              <Stat n={withState.length} label="Trilhas" />
              <Stat n={concluidas} label="Concluídas" />
              <Stat n={certificados} label="Certificados" />
            </div>
          </div>
        </div>
      </section>

      {/* Seções de trilhas */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        {withState.length === 0 ? (
          <div className="card text-center text-slate-500">
            Nenhuma trilha publicada ainda.
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map((sec) => (
              <section key={sec.name}>
                <h2 className="mb-4 text-lg font-bold text-ink">{sec.name}</h2>
                <div className="row-scroll -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
                  {sec.items.map((t) => (
                    <CourseCard
                      key={t.id}
                      id={t.id}
                      title={t.title}
                      description={t.description}
                      coverUrl={t.coverUrl}
                      aulas={t._count.aulas}
                      done={t.done}
                      hasCert={t.hasCert}
                      progress={t.started ? 45 : 0}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="text-xl font-black leading-none">{n}</div>
      <div className="mt-1 text-xs text-white/60">{label}</div>
    </div>
  );
}

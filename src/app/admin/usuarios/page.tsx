import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createUser, deleteUser } from "@/lib/actions/admin";
import AdminShell from "@/components/AdminShell";
import SubmitButton from "@/components/SubmitButton";
import ImportUsersCard from "../import-users-card";

// Onda 3 · Navegação — página dedicada de Usuários (movida do painel único de
// administração). Lista + criação + importação por planilha em um só lugar.
export default async function UsuariosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const profiles = await prisma.accessProfile.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const students = await prisma.user.findMany({
    where: { tenantId: user.tenantId, role: { in: ["STUDENT", "HR"] } },
    orderBy: { createdAt: "asc" },
    include: { accessProfile: { select: { id: true, name: true } } },
  });

  return (
    <AdminShell user={user} tenant={user.tenant}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-slate-500">
          {students.length} pessoa(s). Vincule cada uma a um perfil para controlar o que ela acessa.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="card">
            <h2 className="mb-1 font-semibold">Pessoas</h2>
            <p className="mb-4 text-xs text-slate-500">
              Vincule cada aluno a um perfil para controlar o que ele acessa.
            </p>
            {students.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">Nenhum aluno ainda.</p>
            )}
            <ul className="mb-4 divide-y divide-slate-100">
              {students.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <span className="font-medium">{s.name}</span>
                    {!s.active && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">inativo</span>
                    )}
                    <p className="truncate text-xs text-slate-500">
                      {s.email} · {s.accessProfile?.name ?? "Acesso total"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/alunos/${s.id}`} className="btn-outline px-2 py-1 text-xs">
                      editar
                    </Link>
                    <form action={deleteUser.bind(null, s.id)}>
                      <button className="text-xs text-red-500 hover:underline" type="submit">
                        remover
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            <form action={createUser} className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <input name="name" required className="input" placeholder="Nome do aluno" />
              <input name="email" type="email" required className="input" placeholder="E-mail" />
              <input name="password" type="password" required minLength={6} className="input" placeholder="Senha (mín. 6)" />
              <select name="accessProfileId" className="input" defaultValue="">
                <option value="">Acesso total (sem perfil)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Criando…">Criar aluno</SubmitButton>
              </div>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <ImportUsersCard />
        </section>
      </div>
    </AdminShell>
  );
}

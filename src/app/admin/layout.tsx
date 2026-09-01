import { redirect } from "next/navigation";
import { getCurrentUser, canManageTeams } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";

// Casca persistente da administração. Ficando no layout (e não em cada página),
// a sidebar não re-renderiza a cada navegação — só o conteúdo troca — o que,
// junto com o loading.tsx, faz o clique responder na hora. O guard de acesso
// vive aqui: admin OU RH entram (o RH só enxerga o Painel Gestor — a sidebar
// filtra os itens). Cada página tem o seu próprio guard (as de conteúdo/config
// continuam exigindo isAdmin; as de equipe usam canManageTeams).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageTeams(user.role)) redirect("/dashboard");

  return (
    <AdminShell user={user} tenant={user.tenant}>
      {children}
    </AdminShell>
  );
}

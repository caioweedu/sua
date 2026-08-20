import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";

// Casca persistente da administração. Ficando no layout (e não em cada página),
// a sidebar não re-renderiza a cada navegação — só o conteúdo troca — o que,
// junto com o loading.tsx, faz o clique responder na hora. O guard de acesso
// vive aqui; cada página pode ter guards extras (ex.: filhas = só SUPER_ADMIN).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  return (
    <AdminShell user={user} tenant={user.tenant}>
      {children}
    </AdminShell>
  );
}

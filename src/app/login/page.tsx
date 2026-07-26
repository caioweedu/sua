import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const tenant = await resolveTenant();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="mx-auto mb-4 h-14 object-contain"
            />
          ) : (
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold"
              style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
            >
              {tenant?.name?.charAt(0) ?? "S"}
            </div>
          )}
          <h1 className="text-2xl font-bold">{tenant?.name ?? "Plataforma"}</h1>
          <p className="text-slate-500">Acesse seus treinamentos</p>
        </div>

        <div className="card">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Powered by Weedu · Universidade Corporativa
        </p>
      </div>
    </main>
  );
}

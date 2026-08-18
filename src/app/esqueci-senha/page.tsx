import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import ForgotForm from "./forgot-form";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const tenant = await resolveTenant();
  const name = tenant?.name ?? "Universidade";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-black"
            style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
          >
            {name.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold text-ink">Redefinir senha</h1>
          <p className="mt-1 text-sm text-slate-500">
            Informe o e-mail cadastrado na {name} e enviaremos um link para você
            criar uma nova senha.
          </p>
        </div>
        <ForgotForm />
      </div>
    </main>
  );
}

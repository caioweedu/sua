import Link from "next/link";
import { prisma } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";
import SetPasswordForm from "./set-password-form";

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tenant = await resolveTenant();
  const name = tenant?.name ?? "Universidade";

  const record = await prisma.authToken.findUnique({
    where: { token },
    include: { user: { select: { name: true } } },
  });
  const valid = !!record && !record.usedAt && record.expiresAt >= new Date();
  const isInvite = record?.purpose !== "RESET";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-black"
          style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
        >
          {name.charAt(0)}
        </div>

        {!valid ? (
          <>
            <h1 className="text-2xl font-bold text-ink">Link inválido ou expirado</h1>
            <p className="mt-2 text-sm text-slate-500">
              Este link de acesso não é mais válido. Peça um novo ao administrador da{" "}
              {name}.
            </p>
            <Link href="/login" className="btn-outline mt-6 inline-block">
              Ir para o login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink">
              {isInvite ? "Defina sua senha" : "Redefinir senha"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {record?.user.name ? `Olá, ${record.user.name}. ` : ""}
              Crie uma senha para acessar seus treinamentos na {name}.
            </p>
            <div className="mt-8">
              <SetPasswordForm token={token} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

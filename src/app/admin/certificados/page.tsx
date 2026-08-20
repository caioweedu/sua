import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SubmitButton from "@/components/SubmitButton";
import ImageUpload from "@/components/ImageUpload";
import {
  createCertificateTemplate,
  updateCertificateTemplate,
  deleteCertificateTemplate,
} from "@/lib/actions/admin";

// Biblioteca de modelos de certificado: fundo personalizável reutilizável em
// vários produtos. Os campos por produto (professor, carga horária, etc.) são
// preenchidos ao inserir o certificado no produto.
export default async function CertificadosBibliotecaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");

  const templates = await prisma.certificateTemplate.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { placements: true } } },
  });

  return (
    <>
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Administração
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">Modelos de certificado</h1>
      <p className="mb-6 text-sm text-slate-500">
        Crie modelos com fundo personalizado e insira em qualquer produto. O
        nome do aluno, o curso e a data entram automáticos; professor, carga
        horária e assinatura são preenchidos ao inserir no produto.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          {templates.length === 0 && (
            <div className="card text-sm text-slate-500">
              Nenhum modelo ainda. Crie o primeiro ao lado.
            </div>
          )}
          {templates.map((t) => (
            <div key={t.id} className="card">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {t._count.placements === 0
                    ? "não inserido em produtos"
                    : `inserido em ${t._count.placements} produto(s)`}
                </span>
                <form action={deleteCertificateTemplate.bind(null, t.id)}>
                  <button className="text-xs text-red-500 hover:underline" type="submit">
                    remover
                  </button>
                </form>
              </div>
              <form action={updateCertificateTemplate.bind(null, t.id)} className="space-y-2">
                <input name="name" defaultValue={t.name} className="input" placeholder="Nome do modelo" />
                <ImageUpload
                  name="backgroundUrl"
                  label="Fundo do certificado"
                  hint="A4 paisagem · 3508×2480px (300dpi) · PNG/JPG. Sem imagem, usa o fundo padrão do tenant."
                  defaultValue={t.backgroundUrl ?? ""}
                  slot="certificado"
                  aspect="1.414 / 1"
                />
                <SubmitButton pendingText="Salvando…">Salvar modelo</SubmitButton>
              </form>
            </div>
          ))}
        </section>

        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Novo modelo</h2>
          <form action={createCertificateTemplate} className="space-y-2">
            <input name="name" required className="input" placeholder="Nome do modelo (ex.: Certificado Weedu)" />
            <ImageUpload
              name="backgroundUrl"
              label="Fundo do certificado"
              hint="A4 paisagem · 3508×2480px (300dpi) · PNG/JPG. A imagem é a frente; os textos são sobrepostos automaticamente."
              slot="certificado"
              aspect="1.414 / 1"
            />
            <SubmitButton pendingText="Criando…">Criar modelo</SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}

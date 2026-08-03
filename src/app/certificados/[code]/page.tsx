import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import PrintButton from "@/components/PrintButton";

// Página pública de certificado — serve tanto para o aluno visualizar/imprimir
// quanto para terceiros validarem a autenticidade pelo código.
export default async function CertificadoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const cert = await prisma.certificate.findUnique({
    where: { code },
    include: { trilha: { include: { tenant: true } } },
  });
  if (!cert) notFound();

  const tenant = cert.trilha.tenant;
  const issued = new Date(cert.issuedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <main
      className="min-h-screen bg-slate-100 px-4 py-10"
      style={
        {
          "--brand-color": tenant.brandColor,
          "--brand-fg": tenant.brandFgColor,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-3xl">
        {/* Certificado */}
        <div
          className="relative overflow-hidden rounded-xl border-8 bg-white p-10 text-center shadow-lg"
          style={{
            borderColor: "var(--brand-color)",
            backgroundImage: tenant.certificateBg
              ? `url(${tenant.certificateBg})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {tenant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="mx-auto mb-6 h-14 object-contain"
            />
          )}
          <p className="text-sm uppercase tracking-widest text-slate-500">
            Certificado de Conclusão
          </p>
          <p className="mt-8 text-slate-600">Certificamos que</p>
          <h1 className="mt-2 text-3xl font-bold" style={{ color: "var(--brand-color)" }}>
            {cert.studentName}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">
            concluiu com aproveitamento a trilha de treinamento
          </p>
          <h2 className="mt-1 text-xl font-semibold">{cert.trilhaTitle}</h2>
          <p className="mt-6 text-slate-600">emitido em {issued}</p>

          {tenant.certificateSignature && (
            <div className="mx-auto mt-10 w-64 border-t border-slate-400 pt-2 text-sm text-slate-600">
              {tenant.certificateSignature}
            </div>
          )}

          <p className="mt-8 text-xs text-slate-400">
            Código de validação: <span className="font-mono">{cert.code}</span>
          </p>
          <p className="text-xs text-slate-400">{tenant.name}</p>
        </div>

        <div className="no-print mt-6 flex justify-center gap-3">
          <PrintButton />
          <a href="/dashboard" className="btn-outline">
            Voltar ao painel
          </a>
        </div>
      </div>
    </main>
  );
}

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

  // Usa o snapshot do certificado (Fase 3) com fallback para os padrões do tenant.
  const background = cert.backgroundUrl ?? tenant.certificateBg ?? undefined;
  const assinatura = cert.assinatura ?? tenant.certificateSignature;

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
            backgroundImage: background ? `url(${background})` : undefined,
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

          {(cert.cargaHoraria || cert.professor) && (
            <p className="mt-3 text-sm text-slate-600">
              {cert.cargaHoraria && <>Carga horária: {cert.cargaHoraria}</>}
              {cert.cargaHoraria && cert.professor && " · "}
              {cert.professor && <>Ministrado por: {cert.professor}</>}
            </p>
          )}

          <p className="mt-6 text-slate-600">emitido em {issued}</p>

          {assinatura && (
            <div className="mx-auto mt-10 w-64 border-t border-slate-400 pt-2 text-sm text-slate-600">
              {assinatura}
            </div>
          )}

          <p className="mt-8 text-xs text-slate-400">
            Código de validação: <span className="font-mono">{cert.code}</span>
          </p>
          <p className="text-xs text-slate-400">{tenant.name}</p>
        </div>

        {/* Verso: conteúdo programático */}
        {cert.conteudoProgramatico && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500">
              Conteúdo programático
            </h3>
            <div className="whitespace-pre-line text-sm text-slate-700">
              {cert.conteudoProgramatico}
            </div>
          </div>
        )}

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

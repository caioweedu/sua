import "server-only";
import { Resend } from "resend";

// Envio de e-mail transacional (convite/redefinição de senha). Usa o Resend
// quando as variáveis de ambiente estão configuradas; caso contrário, o envio
// fica indisponível e o admin recebe de volta o link para enviar manualmente.
//
// Variáveis (na Vercel):
//   RESEND_API_KEY  — chave da API (https://resend.com/api-keys)
//   EMAIL_FROM      — remetente verificado, ex: "Weedu <acesso@seudominio.com>"

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type SendResult = { sent: boolean; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!emailConfigured()) {
    return { sent: false, error: "E-mail não configurado (RESEND_API_KEY/EMAIL_FROM)." };
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Falha ao enviar e-mail." };
  }
}

// Modelo simples de e-mail de acesso (convite ou redefinição). Mantém um visual
// neutro e usa a cor da marca do tenant quando informada.
export function accessEmailHtml(opts: {
  studentName: string;
  tenantName: string;
  actionUrl: string;
  purpose: "INVITE" | "RESET";
  brandColor?: string;
}): string {
  const brand = opts.brandColor || "#4f46e5";
  const title =
    opts.purpose === "INVITE"
      ? `Seu acesso à ${opts.tenantName}`
      : `Redefinição de senha · ${opts.tenantName}`;
  const lead =
    opts.purpose === "INVITE"
      ? `Você foi convidado(a) para a plataforma de treinamentos da ${opts.tenantName}. Clique no botão abaixo para definir sua senha e começar.`
      : `Recebemos um pedido para redefinir sua senha na ${opts.tenantName}. Clique no botão abaixo para criar uma nova senha.`;
  const cta = opts.purpose === "INVITE" ? "Definir minha senha" : "Redefinir senha";
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h1 style="font-size:20px;margin:0 0 8px">${title}</h1>
    <p style="font-size:14px;line-height:1.6;color:#334155">Olá, ${opts.studentName}.</p>
    <p style="font-size:14px;line-height:1.6;color:#334155">${lead}</p>
    <p style="margin:24px 0">
      <a href="${opts.actionUrl}" style="background:${brand};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:bold;display:inline-block">${cta}</a>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#64748b">Se o botão não funcionar, copie e cole este endereço no navegador:<br/>
      <a href="${opts.actionUrl}" style="color:${brand};word-break:break-all">${opts.actionUrl}</a>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin-top:24px">Este link expira em 7 dias e só pode ser usado uma vez. Se você não esperava este e-mail, pode ignorá-lo.</p>
  </div>`;
}

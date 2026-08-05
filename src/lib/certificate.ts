import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "./db";
import { loadProgress, isUnlocked, type Progress } from "./release";

// Gera o conteúdo programático a partir dos módulos e aulas do produto.
async function autoConteudo(trilhaId: string): Promise<string> {
  const modulos = await prisma.modulo.findMany({
    where: { trilhaId },
    orderBy: { order: "asc" },
    include: { aulas: { orderBy: { order: "asc" }, select: { title: true } } },
  });
  const linhas: string[] = [];
  for (const m of modulos) {
    linhas.push(m.title);
    for (const a of m.aulas) linhas.push(`• ${a.title}`);
  }
  return linhas.join("\n");
}

function newCode(): string {
  return (
    randomUUID().split("-")[0].toUpperCase() +
    "-" +
    Date.now().toString(36).toUpperCase()
  );
}

export type IssueResult = { code: string } | { error: string };

// Emite (ou retorna, se já existir) o certificado de uma colocação para o aluno,
// desde que a condição de liberação (motor da Fase 2) esteja satisfeita.
// `prog` pode ser passado para reaproveitar o progresso já carregado.
export async function issueCertificateForPlacement(
  userId: string,
  placementId: string,
  prog?: Progress
): Promise<IssueResult> {
  const placement = await prisma.certificatePlacement.findUnique({
    where: { id: placementId },
    include: {
      template: true,
      trilha: { select: { id: true, title: true, tenantId: true } },
      releaseCondition: { include: { clauses: true } },
    },
  });
  if (!placement) return { error: "Certificado não encontrado." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });
  if (!user || user.tenantId !== placement.trilha.tenantId) {
    return { error: "Sem acesso." };
  }

  // Emissão única por aluno/produto (não reemite com dados diferentes).
  const existing = await prisma.certificate.findFirst({
    where: { userId, trilhaId: placement.trilha.id },
  });
  if (existing) return { code: existing.code };

  // Confere a condição de liberação.
  const progress = prog ?? (await loadProgress(userId));
  const r = await isUnlocked(placement.releaseCondition, { trilhaId: placement.trilha.id }, progress);
  if (!r.unlocked) return { error: r.reason ?? "Certificado ainda não liberado." };

  const conteudo =
    placement.conteudoProgramatico?.trim() || (await autoConteudo(placement.trilha.id));
  const backgroundUrl = placement.template.backgroundUrl || user.tenant.certificateBg || null;

  const cert = await prisma.certificate.create({
    data: {
      code: newCode(),
      userId,
      trilhaId: placement.trilha.id,
      studentName: user.name,
      trilhaTitle: placement.trilha.title,
      templateId: placement.templateId,
      backgroundUrl,
      professor: placement.professor,
      cargaHoraria: placement.cargaHoraria,
      assinatura: placement.assinatura || user.tenant.certificateSignature,
      conteudoProgramatico: conteudo,
    },
  });
  return { code: cert.code };
}

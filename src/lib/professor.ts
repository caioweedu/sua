import "server-only";
import { prisma } from "./db";

// Carrega o contexto de uma trilha para alimentar o professor virtual.
// Hoje usamos os metadados (título, descrição, aulas). No futuro dá para
// enriquecer com transcrição dos vídeos e texto dos PDFs.
export async function buildTrilhaContext(trilhaId: string, tenantId: string) {
  const trilha = await prisma.trilha.findFirst({
    where: { id: trilhaId, tenantId },
    include: { aulas: { orderBy: { order: "asc" } }, tenant: true },
  });
  if (!trilha) return null;

  const aulas = trilha.aulas
    .map(
      (a, i) =>
        `Aula ${i + 1}: ${a.title}${a.description ? ` — ${a.description}` : ""}`
    )
    .join("\n");

  const contexto = [
    `Trilha: ${trilha.title}`,
    trilha.description ? `Descrição: ${trilha.description}` : "",
    "",
    "Aulas desta trilha:",
    aulas || "(nenhuma aula cadastrada)",
  ]
    .filter(Boolean)
    .join("\n");

  return { trilha, contexto, tenantName: trilha.tenant.name };
}

// Monta o prompt de sistema no modo "restrito ao conteúdo da trilha".
export function professorSystemPrompt(contexto: string, tenantName: string) {
  return `Você é o Professor Virtual da ${tenantName}, um tutor que ajuda alunos a entenderem o conteúdo de uma trilha de treinamento corporativo.

Regras de comportamento:
- Responda SOMENTE com base no conteúdo da trilha descrito abaixo. Este é um ambiente de treinamento corporativo e o foco deve ser o material do curso.
- Se o aluno perguntar algo fora do escopo desta trilha, explique gentilmente que você é o professor desta trilha específica e reconduza a conversa ao conteúdo do treinamento.
- Seja didático, claro e encorajador. Use exemplos práticos quando ajudar o entendimento.
- Responda em português do Brasil.
- Mantenha as respostas objetivas e no ponto; evite enrolação.
- Você não tem acesso ao conteúdo interno dos vídeos e PDFs, apenas à estrutura da trilha (títulos e descrições). Se precisar de um detalhe que só está no vídeo/PDF, oriente o aluno a rever aquela aula específica.

Conteúdo da trilha:
"""
${contexto}
"""`;
}

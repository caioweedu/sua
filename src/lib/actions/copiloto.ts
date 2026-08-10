"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  propostaSchema,
  questoesSchema,
  type PropostaCurso,
  type PropostaQuestao,
} from "@/lib/copiloto";

export type PublicarResult = {
  ok: boolean;
  error?: string;
  trilhaId?: string;
  stats?: { modulos: number; aulas: number; questoes: number };
};

// Persiste a proposta (já editada pelo gestor) como um novo produto: Trilha ▸
// Módulos ▸ Aulas, e — se houver quiz — uma prova na biblioteca colocada no
// produto. A proposta é RE-VALIDADA aqui: nunca confiamos no cliente.
export async function publicarCurso(args: {
  proposta: PropostaCurso;
  vitrineId?: string | null;
  publicar?: boolean;
}): Promise<PublicarResult> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return { ok: false, error: "Sem permissão." };
  }

  const parsed = propostaSchema.safeParse(args.proposta);
  if (!parsed.success) {
    return { ok: false, error: "Estrutura inválida. Revise os campos." };
  }
  const proposta = parsed.data;
  if (!proposta.titulo.trim()) {
    return { ok: false, error: "O produto precisa de um título." };
  }

  const tenantId = user.tenantId;

  // Vitrine alvo: precisa pertencer ao tenant (ou nenhuma).
  let vitrineId: string | null = null;
  if (args.vitrineId) {
    const v = await prisma.vitrine.findFirst({
      where: { id: args.vitrineId, tenantId },
      select: { id: true },
    });
    if (!v) return { ok: false, error: "Vitrine inválida." };
    vitrineId = v.id;
  }

  const stats = { modulos: 0, aulas: 0, questoes: 0 };

  const trilhaCount = await prisma.trilha.count({ where: { tenantId } });
  const trilha = await prisma.trilha.create({
    data: {
      tenantId,
      vitrineId,
      title: proposta.titulo.trim(),
      description: proposta.descricao.trim() || null,
      published: args.publicar ?? false,
      order: trilhaCount,
    },
    select: { id: true },
  });

  // Módulos e aulas, preservando a ordem da proposta.
  for (let mi = 0; mi < proposta.modulos.length; mi++) {
    const m = proposta.modulos[mi];
    const modulo = await prisma.modulo.create({
      data: { trilhaId: trilha.id, title: m.titulo.trim(), order: mi },
      select: { id: true },
    });
    stats.modulos++;

    for (let ai = 0; ai < m.aulas.length; ai++) {
      const a = m.aulas[ai];
      await prisma.aula.create({
        data: {
          trilhaId: trilha.id,
          moduloId: modulo.id,
          title: a.titulo.trim(),
          description: a.resumo.trim() || null,
          order: ai,
        },
      });
      stats.aulas++;
    }
  }

  // Quiz → prova na biblioteca + colocação no produto.
  if (proposta.quiz.length > 0) {
    const exam = await prisma.exam.create({
      data: {
        tenantId,
        title: `Avaliação — ${proposta.titulo.trim()}`.slice(0, 120),
        placements: { create: { trilhaId: trilha.id } },
      },
      select: { id: true },
    });

    for (let qi = 0; qi < proposta.quiz.length; qi++) {
      const q = proposta.quiz[qi];
      await prisma.question.create({
        data: {
          examId: exam.id,
          statement: q.enunciado.trim(),
          order: qi,
          options: {
            create: q.alternativas.map((text, idx) => ({
              text: text.trim(),
              isCorrect: idx === q.correta,
            })),
          },
        },
      });
      stats.questoes++;
    }
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/trilhas/${trilha.id}`);

  return { ok: true, trilhaId: trilha.id, stats };
}

export type AdicionarQuestoesResult = {
  ok: boolean;
  error?: string;
  criadas?: number;
};

// Anexa questões (geradas pela IA e revisadas) ao banco de uma prova existente.
// Re-valida no servidor e confere a posse da prova pelo tenant.
export async function adicionarQuestoes(args: {
  examId: string;
  questoes: PropostaQuestao[];
}): Promise<AdicionarQuestoesResult> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return { ok: false, error: "Sem permissão." };
  }

  const exam = await prisma.exam.findFirst({
    where: { id: args.examId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!exam) return { ok: false, error: "Prova inválida." };

  const parsed = questoesSchema.safeParse(args.questoes);
  if (!parsed.success || parsed.data.length === 0) {
    return { ok: false, error: "Nenhuma questão válida para adicionar." };
  }

  // Continua a numeração a partir do que já existe no banco.
  const base = await prisma.question.count({ where: { examId: exam.id } });

  let criadas = 0;
  for (let i = 0; i < parsed.data.length; i++) {
    const q = parsed.data[i];
    await prisma.question.create({
      data: {
        examId: exam.id,
        statement: q.enunciado.trim(),
        order: base + i,
        options: {
          create: q.alternativas.map((text, idx) => ({
            text: text.trim(),
            isCorrect: idx === q.correta,
          })),
        },
      },
    });
    criadas++;
  }

  revalidatePath(`/admin/provas/${exam.id}`);
  return { ok: true, criadas };
}

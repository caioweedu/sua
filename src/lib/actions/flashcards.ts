"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { flashcardsSchema, type PropostaFlashcard } from "@/lib/copiloto";

// Confere que a trilha (produto) pertence ao tenant do admin.
async function assertTrilha(trilhaId: string) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) return null;
  const trilha = await prisma.trilha.findFirst({
    where: { id: trilhaId, tenantId: user.tenantId },
    select: { id: true },
  });
  return trilha ? { user, trilha } : null;
}

// Adiciona um flashcard manualmente (formulário do admin).
export async function addFlashcard(trilhaId: string, formData: FormData) {
  const ctx = await assertTrilha(trilhaId);
  if (!ctx) return;

  const front = String(formData.get("front") ?? "").trim();
  const back = String(formData.get("back") ?? "").trim();
  if (!front || !back) return;

  const count = await prisma.flashcard.count({ where: { trilhaId } });
  await prisma.flashcard.create({
    data: {
      trilhaId,
      front: front.slice(0, 500),
      back: back.slice(0, 1000),
      order: count,
    },
  });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function deleteFlashcard(id: string, trilhaId: string) {
  const ctx = await assertTrilha(trilhaId);
  if (!ctx) return;
  // O delete é escopado pela trilha já validada.
  await prisma.flashcard.deleteMany({ where: { id, trilhaId } });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export type AdicionarFlashcardsResult = {
  ok: boolean;
  error?: string;
  criados?: number;
};

// Anexa flashcards (gerados pela IA e revisados) ao deck do produto.
export async function adicionarFlashcards(args: {
  trilhaId: string;
  flashcards: PropostaFlashcard[];
}): Promise<AdicionarFlashcardsResult> {
  const ctx = await assertTrilha(args.trilhaId);
  if (!ctx) return { ok: false, error: "Sem permissão." };

  const parsed = flashcardsSchema.safeParse(args.flashcards);
  if (!parsed.success || parsed.data.length === 0) {
    return { ok: false, error: "Nenhum flashcard válido para adicionar." };
  }

  const base = await prisma.flashcard.count({ where: { trilhaId: args.trilhaId } });
  let criados = 0;
  for (let i = 0; i < parsed.data.length; i++) {
    const f = parsed.data[i];
    await prisma.flashcard.create({
      data: {
        trilhaId: args.trilhaId,
        front: f.front.trim().slice(0, 500),
        back: f.back.trim().slice(0, 1000),
        order: base + i,
      },
    });
    criados++;
  }

  revalidatePath(`/admin/trilhas/${args.trilhaId}`);
  return { ok: true, criados };
}

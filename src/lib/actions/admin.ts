"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin, hashPassword } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) throw new Error("Sem permissão.");
  return user;
}

// --- Vitrines ------------------------------------------------------------
export async function createVitrine(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const slugBase =
    String(formData.get("slug") ?? "").trim() || name;
  const slug =
    slugBase.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `vitrine-${Date.now()}`;
  const count = await prisma.vitrine.count({ where: { tenantId: user.tenantId } });
  await prisma.vitrine.create({
    data: {
      tenantId: user.tenantId,
      name,
      slug,
      description: String(formData.get("description") ?? "").trim() || null,
      coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
      bannerUrl: String(formData.get("bannerUrl") ?? "").trim() || null,
      order: count,
    },
  });
  revalidatePath("/admin");
}

export async function deleteVitrine(vitrineId: string) {
  await requireAdmin();
  // Não apaga os produtos: apenas os desvincula da vitrine.
  await prisma.trilha.updateMany({ where: { vitrineId }, data: { vitrineId: null } });
  await prisma.vitrine.delete({ where: { id: vitrineId } });
  revalidatePath("/admin");
}

// --- Produtos (trilhas) --------------------------------------------------
export async function createTrilha(formData: FormData) {
  const user = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const vitrineId = String(formData.get("vitrineId") ?? "").trim() || null;
  const trilha = await prisma.trilha.create({
    data: {
      tenantId: user.tenantId,
      vitrineId,
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
    },
  });
  redirect(`/admin/trilhas/${trilha.id}`);
}

// Atualiza metadados do produto (vitrine, capa, título, descrição).
export async function updateTrilhaMeta(trilhaId: string, formData: FormData) {
  await requireAdmin();
  await prisma.trilha.update({
    where: { id: trilhaId },
    data: {
      title: String(formData.get("title") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || null,
      coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
      vitrineId: String(formData.get("vitrineId") ?? "").trim() || null,
    },
  });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

// --- Módulos -------------------------------------------------------------
export async function addModulo(trilhaId: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const count = await prisma.modulo.count({ where: { trilhaId } });
  await prisma.modulo.create({ data: { trilhaId, title, order: count } });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function deleteModulo(moduloId: string, trilhaId: string) {
  await requireAdmin();
  await prisma.modulo.delete({ where: { id: moduloId } });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function togglePublish(trilhaId: string, published: boolean) {
  await requireAdmin();
  await prisma.trilha.update({ where: { id: trilhaId }, data: { published } });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
  revalidatePath("/admin");
}

// --- Aulas ---------------------------------------------------------------
// A aula pertence a um módulo; trilhaId é derivado do módulo.
export async function addAula(moduloId: string, trilhaId: string, formData: FormData) {
  await requireAdmin();
  const count = await prisma.aula.count({ where: { moduloId } });
  await prisma.aula.create({
    data: {
      trilhaId,
      moduloId,
      title: String(formData.get("title") ?? "").trim() || "Nova aula",
      description: String(formData.get("description") ?? "").trim() || null,
      videoUrl: String(formData.get("videoUrl") ?? "").trim() || null,
      pdfUrl: String(formData.get("pdfUrl") ?? "").trim() || null,
      order: count,
    },
  });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function deleteAula(aulaId: string, trilhaId: string) {
  await requireAdmin();
  await prisma.aula.delete({ where: { id: aulaId } });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

// --- Prova / banco de questões ------------------------------------------
export async function saveExam(trilhaId: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "Avaliação final").trim();
  const questionsToShow = Math.max(1, Number(formData.get("questionsToShow") ?? 6));
  const passingScore = Math.min(100, Math.max(0, Number(formData.get("passingScore") ?? 70)));
  await prisma.exam.upsert({
    where: { trilhaId },
    update: { title, questionsToShow, passingScore },
    create: { trilhaId, title, questionsToShow, passingScore },
  });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

// Adiciona uma questão de múltipla escolha. As alternativas vêm como
// option0..option3 e o índice correto em `correct`.
export async function addQuestion(
  examId: string,
  trilhaId: string,
  formData: FormData
) {
  await requireAdmin();
  const statement = String(formData.get("statement") ?? "").trim();
  if (!statement) return;
  const correct = Number(formData.get("correct") ?? 0);
  const options: { text: string; isCorrect: boolean }[] = [];
  for (let i = 0; i < 4; i++) {
    const text = String(formData.get(`option${i}`) ?? "").trim();
    if (text) options.push({ text, isCorrect: i === correct });
  }
  if (options.length < 2) return;
  // Garante que ao menos uma correta exista.
  if (!options.some((o) => o.isCorrect)) options[0].isCorrect = true;

  const count = await prisma.question.count({ where: { examId } });
  await prisma.question.create({
    data: {
      examId,
      statement,
      order: count,
      options: { create: options },
    },
  });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function deleteQuestion(questionId: string, trilhaId: string) {
  await requireAdmin();
  await prisma.question.delete({ where: { id: questionId } });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

// --- Filhas (white-label) — apenas SUPER_ADMIN ---------------------------
export async function createDaughter(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Sem permissão.");

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
  const adminPassword = String(formData.get("adminPassword") ?? "");
  if (!name || !slug || !adminEmail || adminPassword.length < 6) return;

  const mother = user.tenant.type === "MOTHER" ? user.tenant : await prisma.tenant.findFirst({ where: { type: "MOTHER" } });

  const daughter = await prisma.tenant.create({
    data: {
      name,
      slug,
      type: "DAUGHTER",
      parentId: mother?.id ?? null,
      brandColor: String(formData.get("brandColor") ?? "#2563eb"),
      customDomain: String(formData.get("customDomain") ?? "").trim().toLowerCase() || null,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: daughter.id,
      name: "Administrador",
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "TENANT_ADMIN",
    },
  });

  revalidatePath("/admin");
}

// --- Branding do próprio tenant -----------------------------------------
export async function updateBranding(formData: FormData) {
  const user = await requireAdmin();
  await prisma.tenant.update({
    where: { id: user.tenantId },
    data: {
      brandColor: String(formData.get("brandColor") ?? user.tenant.brandColor),
      brandFgColor: String(formData.get("brandFgColor") ?? user.tenant.brandFgColor),
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
      bannerUrl: String(formData.get("bannerUrl") ?? "").trim() || null,
      certificateBg: String(formData.get("certificateBg") ?? "").trim() || null,
      certificateSignature: String(formData.get("certificateSignature") ?? "").trim() || null,
    },
  });
  revalidatePath("/admin");
}

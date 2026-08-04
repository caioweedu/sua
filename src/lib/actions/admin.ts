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
      prereqTrilhaId: String(formData.get("prereqTrilhaId") ?? "").trim() || null,
      order: count,
    },
  });
  revalidatePath("/admin");
}

// Define/limpa o pré-requisito de liberação de uma vitrine (B2).
export async function setVitrinePrereq(vitrineId: string, formData: FormData) {
  const user = await requireAdmin();
  const prereq = String(formData.get("prereqTrilhaId") ?? "").trim() || null;
  await prisma.vitrine.update({
    where: { id: vitrineId, tenantId: user.tenantId },
    data: { prereqTrilhaId: prereq },
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
  // Pré-requisito: nunca pode ser a própria trilha.
  const prereq = String(formData.get("prereqTrilhaId") ?? "").trim() || null;
  await prisma.trilha.update({
    where: { id: trilhaId },
    data: {
      title: String(formData.get("title") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || null,
      coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
      vitrineId: String(formData.get("vitrineId") ?? "").trim() || null,
      prereqTrilhaId: prereq === trilhaId ? null : prereq,
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

// --- Biblioteca de provas (Fase 1) --------------------------------------
// A prova agora é um item reutilizável da biblioteca do tenant. Ela é criada e
// editada de forma independente e depois "colocada" em vitrines/produtos/
// módulos via ExamPlacement.

// Lê os campos de configuração da prova a partir do formulário.
function readExamFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "Avaliação final").trim() || "Avaliação final",
    questionsToShow: Math.max(1, Number(formData.get("questionsToShow") ?? 6)),
    passingScore: Math.min(100, Math.max(0, Number(formData.get("passingScore") ?? 70))),
    // Checkboxes: presente = "on".
    shuffleOptions: formData.get("shuffleOptions") != null,
    showAnswers: formData.get("showAnswers") != null,
  };
}

export async function createExam(formData: FormData) {
  const user = await requireAdmin();
  const exam = await prisma.exam.create({
    data: { tenantId: user.tenantId, ...readExamFields(formData) },
  });
  redirect(`/admin/provas/${exam.id}`);
}

export async function updateExam(examId: string, formData: FormData) {
  const user = await requireAdmin();
  await prisma.exam.update({
    where: { id: examId, tenantId: user.tenantId },
    data: readExamFields(formData),
  });
  revalidatePath(`/admin/provas/${examId}`);
}

export async function deleteExam(examId: string) {
  const user = await requireAdmin();
  // Cascade remove colocações e questões.
  await prisma.exam.deleteMany({ where: { id: examId, tenantId: user.tenantId } });
  redirect("/admin/provas");
}

// Adiciona uma questão de múltipla escolha ao banco da prova. As alternativas
// vêm como option0..option3 e o índice correto em `correct`.
export async function addQuestion(examId: string, formData: FormData) {
  const user = await requireAdmin();
  // Garante que a prova é do tenant.
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!exam) return;

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
    data: { examId, statement, order: count, options: { create: options } },
  });
  revalidatePath(`/admin/provas/${examId}`);
}

export async function deleteQuestion(questionId: string, examId: string) {
  await requireAdmin();
  await prisma.question.delete({ where: { id: questionId } });
  revalidatePath(`/admin/provas/${examId}`);
}

// --- Colocação de provas (ExamPlacement) --------------------------------
// Insere uma prova da biblioteca num container. Exatamente um dos ids de
// container é preenchido. Confere que prova e container são do mesmo tenant.

type Container = { vitrineId?: string; trilhaId?: string; moduloId?: string };

async function attachExam(
  tenantId: string,
  examId: string,
  container: Container,
  requireAllLessons: boolean
) {
  if (!examId) return;
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId },
    select: { id: true },
  });
  if (!exam) return;
  await prisma.examPlacement.create({
    data: { examId, ...container, requireAllLessons },
  });
}

export async function attachExamToTrilha(trilhaId: string, formData: FormData) {
  const user = await requireAdmin();
  const examId = String(formData.get("examId") ?? "").trim();
  const requireAllLessons = formData.get("requireAllLessons") != null;
  await attachExam(user.tenantId, examId, { trilhaId }, requireAllLessons);
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function attachExamToModulo(
  moduloId: string,
  trilhaId: string,
  formData: FormData
) {
  const user = await requireAdmin();
  const examId = String(formData.get("examId") ?? "").trim();
  const requireAllLessons = formData.get("requireAllLessons") != null;
  await attachExam(user.tenantId, examId, { moduloId }, requireAllLessons);
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function attachExamToVitrine(vitrineId: string, formData: FormData) {
  const user = await requireAdmin();
  const examId = String(formData.get("examId") ?? "").trim();
  await attachExam(user.tenantId, examId, { vitrineId }, false);
  revalidatePath("/admin");
}

// Remove uma colocação (não apaga a prova da biblioteca). `redirectTo` diz qual
// página revalidar após remover.
export async function detachExamPlacement(placementId: string, redirectTo: string) {
  await requireAdmin();
  await prisma.examPlacement.delete({ where: { id: placementId } });
  revalidatePath(redirectTo);
}

// --- Perfis de acesso ----------------------------------------------------
// Um perfil libera um conjunto de vitrines para os usuários vinculados.
export async function createAccessProfile(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  // As vitrines liberadas chegam como múltiplos campos "vitrineIds".
  const vitrineIds = formData
    .getAll("vitrineIds")
    .map((v) => String(v))
    .filter(Boolean);
  await prisma.accessProfile.create({
    data: {
      tenantId: user.tenantId,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      vitrines: { connect: vitrineIds.map((id) => ({ id })) },
    },
  });
  revalidatePath("/admin");
}

export async function updateAccessProfile(profileId: string, formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const vitrineIds = formData
    .getAll("vitrineIds")
    .map((v) => String(v))
    .filter(Boolean);
  await prisma.accessProfile.update({
    where: { id: profileId, tenantId: user.tenantId },
    data: {
      ...(name ? { name } : {}),
      description: String(formData.get("description") ?? "").trim() || null,
      // `set` substitui totalmente as vitrines liberadas do perfil.
      vitrines: { set: vitrineIds.map((id) => ({ id })) },
    },
  });
  revalidatePath("/admin");
}

export async function deleteAccessProfile(profileId: string) {
  const user = await requireAdmin();
  // Desvincula usuários antes de remover o perfil.
  await prisma.user.updateMany({
    where: { accessProfileId: profileId, tenantId: user.tenantId },
    data: { accessProfileId: null },
  });
  await prisma.accessProfile.delete({ where: { id: profileId } });
  revalidatePath("/admin");
}

// --- Usuários ------------------------------------------------------------
export async function createUser(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || password.length < 6) return;
  const accessProfileId = String(formData.get("accessProfileId") ?? "").trim() || null;

  const exists = await prisma.user.findFirst({
    where: { tenantId: user.tenantId, email },
    select: { id: true },
  });
  if (exists) return;

  await prisma.user.create({
    data: {
      tenantId: user.tenantId,
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "STUDENT",
      accessProfileId,
    },
  });
  revalidatePath("/admin");
}

export async function assignProfile(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const accessProfileId = String(formData.get("accessProfileId") ?? "").trim() || null;
  await prisma.user.update({
    where: { id: userId, tenantId: admin.tenantId },
    data: { accessProfileId },
  });
  revalidatePath("/admin");
}

export async function deleteUser(userId: string) {
  const admin = await requireAdmin();
  // Não permite excluir a si mesmo.
  if (userId === admin.id) return;
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
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

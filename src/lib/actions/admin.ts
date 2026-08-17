"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin, hashPassword } from "@/lib/auth";
import { MAX_LEVEL } from "@/lib/levelBadges";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) throw new Error("Sem permissão.");
  return user;
}

// Slugs reservados para a mãe/sistema (viram subdomínios: sua.weedu.com.br,
// www.weedu.com.br, …). Filhas não podem tomá-los para não sequestrar esses
// endereços quando a resolução por subdomínio estiver ativa.
const RESERVED_SLUGS = new Set([
  "www", "sua", "weedu", "app", "admin", "api", "mail", "auth", "login",
  "dashboard", "painel", "portal", "static", "assets", "cdn", "status",
  "help", "suporte", "docs", "blog",
]);

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

// Atualiza título e/ou capa do módulo (Fatia 2 visual).
export async function updateModulo(
  moduloId: string,
  trilhaId: string,
  formData: FormData
) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  await prisma.modulo.update({
    where: { id: moduloId },
    data: {
      ...(title ? { title } : {}),
      coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
    },
  });
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

// Edita uma aula existente (título, descrição, vídeo e material/PDF).
// Escopo por tenant via a relação com a trilha.
export async function updateAula(
  aulaId: string,
  trilhaId: string,
  formData: FormData
) {
  const user = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  await prisma.aula.updateMany({
    where: { id: aulaId, trilha: { tenantId: user.tenantId } },
    data: {
      ...(title ? { title } : {}),
      description: String(formData.get("description") ?? "").trim() || null,
      videoUrl: String(formData.get("videoUrl") ?? "").trim() || null,
      pdfUrl: String(formData.get("pdfUrl") ?? "").trim() || null,
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

async function attachExam(tenantId: string, examId: string, container: Container) {
  if (!examId) return;
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId },
    select: { id: true },
  });
  if (!exam) return;
  await prisma.examPlacement.create({ data: { examId, ...container } });
}

export async function attachExamToTrilha(trilhaId: string, formData: FormData) {
  const user = await requireAdmin();
  const examId = String(formData.get("examId") ?? "").trim();
  await attachExam(user.tenantId, examId, { trilhaId });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function attachExamToModulo(
  moduloId: string,
  trilhaId: string,
  formData: FormData
) {
  const user = await requireAdmin();
  const examId = String(formData.get("examId") ?? "").trim();
  await attachExam(user.tenantId, examId, { moduloId });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function attachExamToVitrine(vitrineId: string, formData: FormData) {
  const user = await requireAdmin();
  const examId = String(formData.get("examId") ?? "").trim();
  await attachExam(user.tenantId, examId, { vitrineId });
  revalidatePath("/admin");
}

// --- Condição de liberação (Fase 2) -------------------------------------
// Define/atualiza/limpa a condição de um item. `kind` diz qual entidade e `id`
// qual registro. Uma condição vazia (type ausente) limpa a condição.

type CondKind = "vitrine" | "trilha" | "modulo" | "examPlacement" | "certificatePlacement";

async function currentConditionId(kind: CondKind, id: string): Promise<string | null> {
  const sel = { where: { id }, select: { releaseConditionId: true } } as const;
  const row =
    kind === "vitrine"
      ? await prisma.vitrine.findUnique(sel)
      : kind === "trilha"
      ? await prisma.trilha.findUnique(sel)
      : kind === "modulo"
      ? await prisma.modulo.findUnique(sel)
      : kind === "certificatePlacement"
      ? await prisma.certificatePlacement.findUnique(sel)
      : await prisma.examPlacement.findUnique(sel);
  return row?.releaseConditionId ?? null;
}

async function linkCondition(kind: CondKind, id: string, condId: string | null) {
  const data = { releaseConditionId: condId };
  if (kind === "vitrine") await prisma.vitrine.update({ where: { id }, data });
  else if (kind === "trilha") await prisma.trilha.update({ where: { id }, data });
  else if (kind === "modulo") await prisma.modulo.update({ where: { id }, data });
  else if (kind === "certificatePlacement") await prisma.certificatePlacement.update({ where: { id }, data });
  else await prisma.examPlacement.update({ where: { id }, data });
}

// Tipos de cláusula válidos (espelha o motor em lib/release.ts).
const CLAUSE_TYPES = new Set([
  "AFTER_AULA",
  "AFTER_ALL_LESSONS",
  "AFTER_EXAM_PASSED",
  "AFTER_MODULE_COMPLETED",
  "AFTER_TRILHA_COMPLETED",
  "AFTER_PERCENT",
  "AFTER_DAYS",
  "AFTER_LEVEL",
]);

function intOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
}

// Define/atualiza/limpa a REGRA de liberação de um item (Fase 4B). A regra vem
// como JSON no campo "rule": { logic: "ALL"|"ANY", clauses: [...] }. Sem
// cláusulas = limpa a regra.
export async function setReleaseCondition(
  kind: CondKind,
  id: string,
  redirectTo: string,
  formData: FormData
) {
  const user = await requireAdmin();
  const existingId = await currentConditionId(kind, id);

  let parsed: { logic?: string; clauses?: unknown[] } = {};
  try {
    parsed = JSON.parse(String(formData.get("rule") ?? "{}"));
  } catch {
    parsed = {};
  }
  const logic = parsed.logic === "ANY" ? "ANY" : "ALL";
  const rawClauses = Array.isArray(parsed.clauses) ? parsed.clauses : [];

  // Normaliza e mantém só cláusulas com tipo válido; cada campo relevante ao tipo.
  const clauseData = rawClauses
    .map((raw, i) => {
      const c = (raw ?? {}) as Record<string, unknown>;
      const type = String(c.type ?? "");
      if (!CLAUSE_TYPES.has(type)) return null;
      const s = (k: string) => (c[k] ? String(c[k]) : null);
      return {
        type,
        targetAulaId: type === "AFTER_AULA" ? s("targetAulaId") : null,
        targetExamPlacementId: type === "AFTER_EXAM_PASSED" ? s("targetExamPlacementId") : null,
        targetModuloId: type === "AFTER_MODULE_COMPLETED" ? s("targetModuloId") : null,
        targetTrilhaId: type === "AFTER_TRILHA_COMPLETED" ? s("targetTrilhaId") : null,
        minScore: type === "AFTER_EXAM_PASSED" ? intOrNull(c.minScore) : null,
        percent: type === "AFTER_PERCENT" ? intOrNull(c.percent) : null,
        days: type === "AFTER_DAYS" ? intOrNull(c.days) : null,
        minLevel: type === "AFTER_LEVEL" ? intOrNull(c.minLevel) : null,
        order: i,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Sem cláusulas → limpa a regra (e remove a linha órfã).
  if (clauseData.length === 0) {
    if (existingId) {
      await linkCondition(kind, id, null);
      await prisma.releaseCondition.delete({ where: { id: existingId } }).catch(() => {});
    }
    revalidatePath(redirectTo);
    return;
  }

  if (existingId) {
    await prisma.releaseCondition.update({ where: { id: existingId }, data: { logic } });
    await prisma.releaseClause.deleteMany({ where: { conditionId: existingId } });
    await prisma.releaseClause.createMany({
      data: clauseData.map((c) => ({ ...c, conditionId: existingId })),
    });
  } else {
    const cond = await prisma.releaseCondition.create({
      data: { tenantId: user.tenantId, logic, clauses: { create: clauseData } },
    });
    await linkCondition(kind, id, cond.id);
  }
  revalidatePath(redirectTo);
}

// Remove uma colocação (não apaga a prova da biblioteca). `redirectTo` diz qual
// página revalidar após remover.
export async function detachExamPlacement(placementId: string, redirectTo: string) {
  await requireAdmin();
  const p = await prisma.examPlacement.findUnique({
    where: { id: placementId },
    select: { releaseConditionId: true },
  });
  await prisma.examPlacement.delete({ where: { id: placementId } });
  if (p?.releaseConditionId) {
    await prisma.releaseCondition.delete({ where: { id: p.releaseConditionId } }).catch(() => {});
  }
  revalidatePath(redirectTo);
}

// --- Certificados: biblioteca de modelos (Fase 3) -----------------------
export async function createCertificateTemplate(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.certificateTemplate.create({
    data: {
      tenantId: user.tenantId,
      name,
      backgroundUrl: String(formData.get("backgroundUrl") ?? "").trim() || null,
    },
  });
  revalidatePath("/admin/certificados");
}

export async function updateCertificateTemplate(templateId: string, formData: FormData) {
  const user = await requireAdmin();
  await prisma.certificateTemplate.updateMany({
    where: { id: templateId, tenantId: user.tenantId },
    data: {
      name: String(formData.get("name") ?? "").trim() || undefined,
      backgroundUrl: String(formData.get("backgroundUrl") ?? "").trim() || null,
    },
  });
  revalidatePath("/admin/certificados");
}

export async function deleteCertificateTemplate(templateId: string) {
  const user = await requireAdmin();
  await prisma.certificateTemplate.deleteMany({
    where: { id: templateId, tenantId: user.tenantId },
  });
  revalidatePath("/admin/certificados");
}

// --- Certificados: colocação no produto ---------------------------------
function readCertFields(formData: FormData) {
  return {
    professor: String(formData.get("professor") ?? "").trim() || null,
    cargaHoraria: String(formData.get("cargaHoraria") ?? "").trim() || null,
    assinatura: String(formData.get("assinatura") ?? "").trim() || null,
    conteudoProgramatico: String(formData.get("conteudoProgramatico") ?? "").trim() || null,
  };
}

export async function attachCertificateToTrilha(trilhaId: string, formData: FormData) {
  const user = await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "").trim();
  if (!templateId) return;
  // Confere que o modelo é do tenant.
  const tpl = await prisma.certificateTemplate.findFirst({
    where: { id: templateId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!tpl) return;
  await prisma.certificatePlacement.create({
    data: { templateId, trilhaId, ...readCertFields(formData) },
  });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function updateCertificatePlacement(
  placementId: string,
  trilhaId: string,
  formData: FormData
) {
  await requireAdmin();
  await prisma.certificatePlacement.update({
    where: { id: placementId },
    data: readCertFields(formData),
  });
  revalidatePath(`/admin/trilhas/${trilhaId}`);
}

export async function detachCertificatePlacement(placementId: string, redirectTo: string) {
  await requireAdmin();
  const p = await prisma.certificatePlacement.findUnique({
    where: { id: placementId },
    select: { releaseConditionId: true },
  });
  await prisma.certificatePlacement.delete({ where: { id: placementId } });
  if (p?.releaseConditionId) {
    await prisma.releaseCondition.delete({ where: { id: p.releaseConditionId } }).catch(() => {});
  }
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

  if (RESERVED_SLUGS.has(slug)) throw new Error(`O endereço "${slug}" é reservado. Escolha outro.`);
  const slugClash = await prisma.tenant.findFirst({ where: { slug }, select: { id: true } });
  if (slugClash) throw new Error("Já existe uma universidade com este endereço (slug).");

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

export async function updateDaughter(daughterId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Sem permissão.");

  const target = await prisma.tenant.findFirst({
    where: { id: daughterId, type: "DAUGHTER" },
    select: { id: true },
  });
  if (!target) return;

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const customDomain = String(formData.get("customDomain") ?? "").trim().toLowerCase() || null;
  const brandColor = String(formData.get("brandColor") ?? "").trim();
  const active = formData.get("active") != null;

  // Slug é único e não pode ser um endereço reservado.
  if (slug) {
    if (RESERVED_SLUGS.has(slug)) throw new Error(`O endereço "${slug}" é reservado. Escolha outro.`);
    const clash = await prisma.tenant.findFirst({
      where: { slug, id: { not: daughterId } },
      select: { id: true },
    });
    if (clash) throw new Error("Já existe uma universidade com este endereço (slug).");
  }

  await prisma.tenant.update({
    where: { id: daughterId },
    data: {
      ...(name ? { name } : {}),
      ...(slug ? { slug } : {}),
      customDomain,
      ...(brandColor ? { brandColor } : {}),
      active,
    },
  });
  revalidatePath("/admin");
}

// A MÃE (Weedu) define quais das SUAS vitrines cada filha recebe (white-label).
// Recebe os ids liberados e reescreve as liberações daquela filha.
export async function saveDaughterGrants(daughterId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Sem permissão.");

  // A filha precisa ser filha desta mãe.
  const daughter = await prisma.tenant.findFirst({
    where: { id: daughterId, type: "DAUGHTER", parentId: user.tenantId },
    select: { id: true },
  });
  if (!daughter) return;

  const motherVitrineIds = new Set(
    (
      await prisma.vitrine.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true },
      })
    ).map((v) => v.id)
  );
  const granted = formData
    .getAll("grantVitrineIds")
    .map((v) => String(v))
    .filter((id) => motherVitrineIds.has(id));

  await prisma.sharedVitrineGrant.deleteMany({ where: { tenantId: daughterId } });
  if (granted.length > 0) {
    await prisma.sharedVitrineGrant.createMany({
      data: granted.map((vitrineId) => ({ tenantId: daughterId, vitrineId })),
    });
  }
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
      theme: String(formData.get("theme") ?? "dark") === "light" ? "light" : "dark",
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
      bannerUrl: String(formData.get("bannerUrl") ?? "").trim() || null,
      certificateBg: String(formData.get("certificateBg") ?? "").trim() || null,
      certificateSignature: String(formData.get("certificateSignature") ?? "").trim() || null,
    },
  });
  revalidatePath("/admin");
}

// --- Ícones dos níveis (arte global da Weedu) — SUPER_ADMIN --------------
export async function saveLevelIcons(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Sem permissão.");

  for (let level = 1; level <= MAX_LEVEL; level++) {
    const url = String(formData.get(`icon_${level}`) ?? "").trim();
    if (url) {
      await prisma.levelIcon.upsert({
        where: { level },
        update: { iconUrl: url },
        create: { level, iconUrl: url },
      });
    } else {
      // Campo vazio = usar o emoji padrão (remove a arte cadastrada).
      await prisma.levelIcon.deleteMany({ where: { level } });
    }
  }
  revalidatePath("/admin/niveis");
  revalidatePath("/dashboard");
  revalidatePath("/niveis");
}

// --- Gamificação do próprio tenant (Onda 2, Fatia 5) --------------------
export async function updateGamificationSettings(formData: FormData) {
  const user = await requireAdmin();
  await prisma.tenant.update({
    where: { id: user.tenantId },
    data: {
      // Checkbox ausente = desmarcado = false.
      gamificationEnabled: formData.get("gamificationEnabled") != null,
      rankingEnabled: formData.get("rankingEnabled") != null,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

// --- Hero / banner rotativo da home (Fatia 2 visual) --------------------
export async function createHeroSlide(formData: FormData) {
  const user = await requireAdmin();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  if (!imageUrl) return; // slide sem imagem não faz sentido
  const count = await prisma.heroSlide.count({ where: { tenantId: user.tenantId } });
  await prisma.heroSlide.create({
    data: {
      tenantId: user.tenantId,
      imageUrl,
      title: String(formData.get("title") ?? "").trim() || null,
      subtitle: String(formData.get("subtitle") ?? "").trim() || null,
      ctaLabel: String(formData.get("ctaLabel") ?? "").trim() || null,
      ctaHref: String(formData.get("ctaHref") ?? "").trim() || null,
      order: count,
    },
  });
  revalidatePath("/admin");
}

export async function updateHeroSlide(slideId: string, formData: FormData) {
  const user = await requireAdmin();
  await prisma.heroSlide.updateMany({
    where: { id: slideId, tenantId: user.tenantId },
    data: {
      imageUrl: String(formData.get("imageUrl") ?? "").trim() || undefined,
      title: String(formData.get("title") ?? "").trim() || null,
      subtitle: String(formData.get("subtitle") ?? "").trim() || null,
      ctaLabel: String(formData.get("ctaLabel") ?? "").trim() || null,
      ctaHref: String(formData.get("ctaHref") ?? "").trim() || null,
      active: formData.get("active") != null,
    },
  });
  revalidatePath("/admin");
}

export async function deleteHeroSlide(slideId: string) {
  const user = await requireAdmin();
  await prisma.heroSlide.deleteMany({ where: { id: slideId, tenantId: user.tenantId } });
  revalidatePath("/admin");
}

// Move um slide para cima/baixo trocando a ordem com o vizinho.
export async function moveHeroSlide(slideId: string, dir: "up" | "down") {
  const user = await requireAdmin();
  const slides = await prisma.heroSlide.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const i = slides.findIndex((s) => s.id === slideId);
  if (i < 0) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= slides.length) return;
  await prisma.$transaction([
    prisma.heroSlide.update({ where: { id: slides[i].id }, data: { order: j } }),
    prisma.heroSlide.update({ where: { id: slides[j].id }, data: { order: i } }),
  ]);
  revalidatePath("/admin");
}

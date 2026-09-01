"use server";

// Onda 3 · F3 — Agenda de treinamentos (PDI). Atribuir/remover treinamentos a
// uma pessoa ou equipe, com prazo. Guardado por requireAdmin e escopado ao
// tenant (o alvo e o produto precisam pertencer ao tenant/escopo de conteúdo).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManageTeams } from "@/lib/auth";
import { contentTenantIds } from "@/lib/access";
import { parseCsv } from "@/lib/csv";

// Planejamento/agenda é gerido pelo admin OU pelo RH.
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canManageTeams(user.role)) throw new Error("Sem permissão.");
  return user;
}

export async function assignTraining(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim() || null;
  const teamId = String(formData.get("teamId") ?? "").trim() || null;
  const startRaw = String(formData.get("startDate") ?? "").trim();
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const required = formData.get("required") != null;
  // Validade/recorrência em meses (opcional). Só vale para obrigatórios.
  const recRaw = parseInt(String(formData.get("recurrenceMonths") ?? "").trim(), 10);
  const recurrenceMonths = required && Number.isFinite(recRaw) && recRaw > 0 ? recRaw : null;

  // Produtos: um ou vários (checkboxes por vitrine) — aceita também o campo
  // único legado `trilhaId`.
  const ids = [
    ...formData.getAll("trilhaIds").map((v) => String(v).trim()),
    String(formData.get("trilhaId") ?? "").trim(),
  ].filter(Boolean);
  const trilhaIds = [...new Set(ids)];

  // Exatamente um alvo, e ao menos um produto.
  if (trilhaIds.length === 0 || (!userId && !teamId) || (userId && teamId)) return;

  // Alvo precisa ser do tenant.
  if (userId) {
    const u = await prisma.user.findFirst({
      where: { id: userId, tenantId: admin.tenantId },
      select: { id: true },
    });
    if (!u) return;
  }
  if (teamId) {
    const t = await prisma.team.findFirst({
      where: { id: teamId, tenantId: admin.tenantId },
      select: { id: true },
    });
    if (!t) return;
  }

  // Produtos válidos dentro do escopo de conteúdo do tenant.
  const validTrilhas = await prisma.trilha.findMany({
    where: { id: { in: trilhaIds }, tenantId: { in: contentTenantIds(admin.tenant) } },
    select: { id: true },
  });
  if (validTrilhas.length === 0) return;

  const startDate = startRaw ? new Date(startRaw) : null;
  const dueDate = dueRaw ? new Date(dueRaw) : null;

  for (const t of validTrilhas) {
    // Não duplica a mesma atribuição (produto + alvo): atualiza as datas.
    const existing = await prisma.trainingAssignment.findFirst({
      where: { tenantId: admin.tenantId, trilhaId: t.id, userId, teamId },
      select: { id: true },
    });
    if (existing) {
      await prisma.trainingAssignment.update({
        where: { id: existing.id },
        data: { startDate, dueDate, required, recurrenceMonths },
      });
    } else {
      await prisma.trainingAssignment.create({
        data: { tenantId: admin.tenantId, trilhaId: t.id, userId, teamId, startDate, dueDate, required, recurrenceMonths, createdById: admin.id },
      });
    }
  }

  revalidatePath("/admin");
  if (userId) revalidatePath(`/admin/alunos/${userId}`);
  revalidatePath("/dashboard");
}

// --- Importação de planejamento por planilha -----------------------------
export type ImportPlanningResult = {
  ok: boolean;
  message?: string;
  error?: string;
  stats?: { criados: number; atualizados: number };
  avisos?: string[];
};

async function readCsv(v: FormDataEntryValue | null): Promise<string | null> {
  if (!v || typeof v === "string") return null;
  const file = v as File;
  if (file.size === 0) return null;
  return await file.text();
}

export async function importPlanning(
  _prev: ImportPlanningResult,
  formData: FormData
): Promise<ImportPlanningResult> {
  const admin = await requireAdmin();
  const csv = await readCsv(formData.get("planejamento"));
  if (!csv) return { ok: false, error: "Envie a planilha de planejamento." };
  const rows = parseCsv(csv);
  if (rows.length < 2) return { ok: false, error: "Planilha sem linhas de dados." };

  const contentIds = contentTenantIds(admin.tenant);
  const [users, teams, trilhas, vitrines] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: admin.tenantId, role: { in: ["STUDENT", "HR"] } },
      select: { id: true, email: true },
    }),
    prisma.team.findMany({ where: { tenantId: admin.tenantId }, select: { id: true, name: true } }),
    prisma.trilha.findMany({
      where: { tenantId: { in: contentIds }, published: true },
      select: { id: true, title: true },
    }),
    // Vitrines (para "vitrine:Nome" = todos os treinamentos publicados dela).
    prisma.vitrine.findMany({
      where: { tenantId: { in: contentIds } },
      select: { name: true, trilhas: { where: { published: true }, select: { id: true } } },
    }),
  ]);
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const teamByName = new Map(teams.map((t) => [t.name.toLowerCase(), t.id]));
  const trilhaByTitle = new Map(trilhas.map((t) => [t.title.toLowerCase(), t.id]));
  const vitrineByName = new Map(vitrines.map((v) => [v.name.toLowerCase(), v.trilhas.map((t) => t.id)]));

  const stats = { criados: 0, atualizados: 0 };
  const avisos: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i].map((c) => (c ?? "").trim());
    const [email = "", equipe = "", produto = "", inicio = "", fim = "", obrig = ""] = r;
    if (!produto || (!email && !equipe)) {
      avisos.push(`Linha ${i + 1} ignorada: falta o treinamento e/ou o alvo (e-mail ou equipe).`);
      continue;
    }
    // "Treinamento" pode ser um produto OU uma vitrine inteira. Use o prefixo
    // "vitrine:Nome" para forçar a vitrine; sem prefixo, tenta o produto e, se
    // não achar, cai para uma vitrine de mesmo nome.
    const prodLower = produto.toLowerCase();
    const vitrineForced = prodLower.startsWith("vitrine:") ? prodLower.slice(8).trim() : null;
    let trilhaIds: string[] = [];
    if (vitrineForced) {
      const ids = vitrineByName.get(vitrineForced) ?? [];
      if (ids.length === 0) {
        avisos.push(`Linha ${i + 1}: vitrine "${produto.slice(8).trim()}" não encontrada ou sem treinamentos publicados.`);
        continue;
      }
      trilhaIds = ids;
    } else {
      const single = trilhaByTitle.get(prodLower);
      const vitrineIds = vitrineByName.get(prodLower);
      if (single) trilhaIds = [single];
      else if (vitrineIds && vitrineIds.length > 0) trilhaIds = vitrineIds;
      else {
        avisos.push(`Linha ${i + 1}: treinamento/vitrine "${produto}" não encontrado.`);
        continue;
      }
    }
    let userId: string | null = null;
    let teamId: string | null = null;
    if (email) {
      userId = userByEmail.get(email.toLowerCase()) ?? null;
      if (!userId) {
        avisos.push(`Linha ${i + 1}: e-mail "${email}" não encontrado.`);
        continue;
      }
    } else {
      teamId = teamByName.get(equipe.toLowerCase()) ?? null;
      if (!teamId) {
        avisos.push(`Linha ${i + 1}: equipe "${equipe}" não encontrada.`);
        continue;
      }
    }
    const startDate = inicio ? new Date(inicio) : null;
    const dueDate = fim ? new Date(fim) : null;
    const req = obrig.toLowerCase();
    const required = !["não", "nao", "n", "false", "0"].includes(req);

    // Uma linha pode expandir para vários treinamentos (quando é uma vitrine).
    for (const trilhaId of trilhaIds) {
      const existing = await prisma.trainingAssignment.findFirst({
        where: { tenantId: admin.tenantId, trilhaId, userId, teamId },
        select: { id: true },
      });
      if (existing) {
        await prisma.trainingAssignment.update({ where: { id: existing.id }, data: { startDate, dueDate, required } });
        stats.atualizados++;
      } else {
        await prisma.trainingAssignment.create({
          data: { tenantId: admin.tenantId, trilhaId, userId, teamId, startDate, dueDate, required, createdById: admin.id },
        });
        stats.criados++;
      }
    }
  }

  revalidatePath("/admin/planejamento");
  revalidatePath("/dashboard");
  return { ok: true, message: "Planejamento importado.", stats, avisos: avisos.length ? avisos : undefined };
}

export async function removeAssignment(id: string) {
  const admin = await requireAdmin();
  const a = await prisma.trainingAssignment.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: { id: true, userId: true },
  });
  if (!a) return;
  await prisma.trainingAssignment.delete({ where: { id } });
  revalidatePath("/admin");
  if (a.userId) revalidatePath(`/admin/alunos/${a.userId}`);
  revalidatePath("/dashboard");
}

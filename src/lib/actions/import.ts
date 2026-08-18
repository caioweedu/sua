"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin, hashPassword } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";

export type ImportResult = {
  ok: boolean;
  message?: string;
  error?: string;
  stats?: {
    vitrines: number;
    produtos: number;
    modulos: number;
    aulas: number;
    provas: number;
    questoes: number;
  };
  avisos?: string[];
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `item-${Date.now()}`
  );
}

// Lê um File do FormData como texto (ou null se não enviado).
async function readFile(v: FormDataEntryValue | null): Promise<string | null> {
  if (!v || typeof v === "string") return null;
  const file = v as File;
  if (file.size === 0) return null;
  return await file.text();
}

export async function importContent(
  _prev: ImportResult,
  formData: FormData
): Promise<ImportResult> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return { ok: false, error: "Sem permissão." };
  }

  const conteudoCsv = await readFile(formData.get("conteudo"));
  const provasCsv = await readFile(formData.get("provas"));

  if (!conteudoCsv && !provasCsv) {
    return { ok: false, error: "Envie ao menos uma planilha (conteúdo ou provas)." };
  }

  const tenantId = user.tenantId;
  const stats = { vitrines: 0, produtos: 0, modulos: 0, aulas: 0, provas: 0, questoes: 0 };
  const avisos: string[] = [];

  // Caches para não repetir consultas dentro do mesmo import.
  const vitrineCache = new Map<string, string | null>(); // nome -> id
  const trilhaCache = new Map<string, string>(); // titulo -> id

  async function getOrCreateVitrine(name: string): Promise<string | null> {
    if (!name) return null;
    if (vitrineCache.has(name)) return vitrineCache.get(name)!;
    let v = await prisma.vitrine.findFirst({
      where: { tenantId, name },
      select: { id: true },
    });
    if (!v) {
      // Gera um slug único dentro do tenant.
      const base = slugify(name);
      let slug = base;
      let n = 1;
      while (await prisma.vitrine.findFirst({ where: { tenantId, slug }, select: { id: true } })) {
        slug = `${base}-${n++}`;
      }
      const count = await prisma.vitrine.count({ where: { tenantId } });
      v = await prisma.vitrine.create({
        data: { tenantId, name, slug, published: true, order: count },
        select: { id: true },
      });
      stats.vitrines++;
    }
    vitrineCache.set(name, v.id);
    return v.id;
  }

  async function getOrCreateTrilha(
    title: string,
    vitrineId: string | null,
    description: string | null
  ): Promise<string> {
    const key = `${vitrineId ?? "-"}::${title}`;
    if (trilhaCache.has(key)) return trilhaCache.get(key)!;
    let t = await prisma.trilha.findFirst({
      where: { tenantId, title, vitrineId },
      select: { id: true },
    });
    if (!t) {
      const count = await prisma.trilha.count({ where: { tenantId } });
      t = await prisma.trilha.create({
        data: {
          tenantId,
          vitrineId,
          title,
          description: description || null,
          published: true,
          order: count,
        },
        select: { id: true },
      });
      stats.produtos++;
    } else if (description) {
      // Preenche a descrição se ainda estiver vazia.
      await prisma.trilha.updateMany({
        where: { id: t.id, description: null },
        data: { description },
      });
    }
    trilhaCache.set(key, t.id);
    return t.id;
  }

  // --- CONTEÚDO ----------------------------------------------------------
  if (conteudoCsv) {
    const rows = parseCsv(conteudoCsv);
    if (rows.length < 2) {
      avisos.push("Planilha de conteúdo sem linhas de dados.");
    } else {
      // Pula o cabeçalho (linha 0).
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const [
          vitrineName = "",
          produtoTitle = "",
          produtoDesc = "",
          moduloTitle = "",
          aulaTitle = "",
          videoUrl = "",
          pdfUrl = "",
          aulaDesc = "",
        ] = r.map((c) => (c ?? "").trim());

        if (!produtoTitle) {
          avisos.push(`Linha ${i + 1} do conteúdo ignorada: sem produto.`);
          continue;
        }

        const vitrineId = await getOrCreateVitrine(vitrineName);
        const trilhaId = await getOrCreateTrilha(produtoTitle, vitrineId, produtoDesc);

        // Módulo (opcional).
        let moduloId: string | null = null;
        if (moduloTitle) {
          let m = await prisma.modulo.findFirst({
            where: { trilhaId, title: moduloTitle },
            select: { id: true },
          });
          if (!m) {
            const mc = await prisma.modulo.count({ where: { trilhaId } });
            m = await prisma.modulo.create({
              data: { trilhaId, title: moduloTitle, order: mc },
              select: { id: true },
            });
            stats.modulos++;
          }
          moduloId = m.id;
        }

        // Aula (opcional — a linha pode servir só para criar a estrutura).
        if (aulaTitle) {
          const existing = await prisma.aula.findFirst({
            where: { trilhaId, moduloId, title: aulaTitle },
            select: { id: true },
          });
          if (!existing) {
            const ac = await prisma.aula.count({ where: { trilhaId, moduloId } });
            await prisma.aula.create({
              data: {
                trilhaId,
                moduloId,
                title: aulaTitle,
                description: aulaDesc || null,
                videoUrl: videoUrl || null,
                pdfUrl: pdfUrl || null,
                order: ac,
              },
            });
            stats.aulas++;
          }
        }
      }
    }
  }

  // --- PROVAS ------------------------------------------------------------
  if (provasCsv) {
    const rows = parseCsv(provasCsv);
    if (rows.length < 2) {
      avisos.push("Planilha de provas sem linhas de dados.");
    } else {
      const examCache = new Map<string, string>(); // trilhaId -> examId
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i].map((c) => (c ?? "").trim());
        const produtoTitle = r[0] ?? "";
        const statement = r[1] ?? "";
        const alts = r.slice(2).filter((a) => a !== "");

        if (!produtoTitle || !statement) {
          avisos.push(`Linha ${i + 1} das provas ignorada: falta produto ou enunciado.`);
          continue;
        }
        if (alts.length < 2) {
          avisos.push(`Linha ${i + 1} das provas ignorada: mínimo de 2 alternativas.`);
          continue;
        }

        // Localiza a trilha pelo título (deve existir no tenant).
        const trilha = await prisma.trilha.findFirst({
          where: { tenantId, title: produtoTitle },
          select: { id: true },
        });
        if (!trilha) {
          avisos.push(`Prova linha ${i + 1}: produto "${produtoTitle}" não encontrado.`);
          continue;
        }

        // Garante a prova do produto: procura uma prova já colocada no produto
        // (placement de trilha). Se não houver, cria a prova na biblioteca e a
        // coloca no produto. Conta como criada só quando não existia.
        let examId = examCache.get(trilha.id);
        if (!examId) {
          const existingPlacement = await prisma.examPlacement.findFirst({
            where: { trilhaId: trilha.id, moduloId: null, vitrineId: null },
            select: { examId: true },
          });
          if (existingPlacement) {
            examId = existingPlacement.examId;
          } else {
            const created = await prisma.exam.create({
              data: {
                tenantId,
                title: "Avaliação final",
                placements: { create: { trilhaId: trilha.id } },
              },
              select: { id: true },
            });
            examId = created.id;
            stats.provas++;
          }
          examCache.set(trilha.id, examId);
        }

        // Evita duplicar a mesma questão (mesmo enunciado).
        const dup = await prisma.question.findFirst({
          where: { examId, statement },
          select: { id: true },
        });
        if (dup) continue;

        const qc = await prisma.question.count({ where: { examId } });
        await prisma.question.create({
          data: {
            examId,
            statement,
            order: qc,
            // A 1ª alternativa é a correta.
            options: {
              create: alts.map((text, idx) => ({ text, isCorrect: idx === 0 })),
            },
          },
        });
        stats.questoes++;
      }
    }
  }

  revalidatePath("/admin");

  return {
    ok: true,
    message: "Importação concluída.",
    stats,
    avisos: avisos.length ? avisos : undefined,
  };
}

// ---------------------------------------------------------------------------
// IMPORTAÇÃO DE USUÁRIOS (planilha)
// ---------------------------------------------------------------------------
// Colunas: Nome · E-mail · Telefone · Perfil de acesso · Equipe · Senha (opc.).
// Perfil e Equipe são casados pelo NOME dentro do tenant (se não existir, o
// usuário é criado sem eles e um aviso é registrado). Re-subir a mesma planilha
// atualiza os usuários (casados por e-mail) sem apagar dados deixados em branco.

export type ImportUsersResult = {
  ok: boolean;
  message?: string;
  error?: string;
  stats?: { criados: number; atualizados: number };
  avisos?: string[];
};

export async function importUsers(
  _prev: ImportUsersResult,
  formData: FormData
): Promise<ImportUsersResult> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return { ok: false, error: "Sem permissão." };
  }

  const csv = await readFile(formData.get("usuarios"));
  if (!csv) return { ok: false, error: "Envie a planilha de usuários." };

  const tenantId = user.tenantId;
  const rows = parseCsv(csv);
  if (rows.length < 2) return { ok: false, error: "Planilha de usuários sem linhas de dados." };

  const stats = { criados: 0, atualizados: 0 };
  const avisos: string[] = [];

  // Casa perfil/equipe pelo nome (uma consulta só).
  const [profiles, teams] = await Promise.all([
    prisma.accessProfile.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.team.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  const profileByName = new Map(profiles.map((p) => [p.name.toLowerCase(), p.id]));
  const teamByName = new Map(teams.map((t) => [t.name.toLowerCase(), t.id]));

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i].map((c) => (c ?? "").trim());
    const [nome = "", email = "", telefone = "", perfilName = "", equipeName = "", senha = ""] = r;

    if (!nome || !email) {
      avisos.push(`Linha ${i + 1} ignorada: falta nome ou e-mail.`);
      continue;
    }
    const emailLc = email.toLowerCase();

    let accessProfileId: string | null = null;
    if (perfilName) {
      accessProfileId = profileByName.get(perfilName.toLowerCase()) ?? null;
      if (!accessProfileId) avisos.push(`Linha ${i + 1}: perfil "${perfilName}" não encontrado (ignorado).`);
    }
    let teamId: string | null = null;
    if (equipeName) {
      teamId = teamByName.get(equipeName.toLowerCase()) ?? null;
      if (!teamId) avisos.push(`Linha ${i + 1}: equipe "${equipeName}" não encontrada (ignorada).`);
    }

    const existing = await prisma.user.findFirst({
      where: { tenantId, email: emailLc },
      select: { id: true },
    });

    if (existing) {
      // Atualiza só o que veio preenchido — não apaga dados deixados em branco.
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: nome,
          ...(telefone ? { phone: telefone } : {}),
          ...(perfilName && accessProfileId ? { accessProfileId } : {}),
          ...(equipeName && teamId ? { teamId } : {}),
          ...(senha ? { passwordHash: await hashPassword(senha) } : {}),
        },
      });
      stats.atualizados++;
    } else {
      // Sem senha na planilha: cria uma aleatória (o acesso é definido depois
      // pelo convite/"esqueci minha senha").
      const pwd = senha || crypto.randomBytes(9).toString("base64url");
      await prisma.user.create({
        data: {
          tenantId,
          name: nome,
          email: emailLc,
          phone: telefone || null,
          role: "STUDENT",
          accessProfileId,
          teamId,
          passwordHash: await hashPassword(pwd),
        },
      });
      stats.criados++;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/equipes");
  return {
    ok: true,
    message: "Importação de usuários concluída.",
    stats,
    avisos: avisos.length ? avisos : undefined,
  };
}

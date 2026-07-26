import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);

  // --- Tenant mãe (Weedu) -------------------------------------------------
  const mother = await prisma.tenant.upsert({
    where: { slug: "weedu" },
    update: {},
    create: {
      name: "Universidade Weedu",
      slug: "weedu",
      type: "MOTHER",
      brandColor: "#0f766e",
      brandFgColor: "#ffffff",
      certificateSignature: "Weedu Soluções — Gestão de Resultados",
    },
  });

  // --- Tenant filha (cliente white-label de exemplo) ----------------------
  const daughter = await prisma.tenant.upsert({
    where: { slug: "cliente-demo" },
    update: {},
    create: {
      name: "Universidade Cliente Demo",
      slug: "cliente-demo",
      type: "DAUGHTER",
      parentId: mother.id,
      brandColor: "#7c3aed",
      brandFgColor: "#ffffff",
      certificateSignature: "Cliente Demo Ltda.",
    },
  });

  // --- Usuários -----------------------------------------------------------
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: mother.id, email: "admin@weedu.com.br" } },
    update: {},
    create: {
      tenantId: mother.id,
      name: "Administrador Weedu",
      email: "admin@weedu.com.br",
      passwordHash: await hash("weedu123"),
      role: "SUPER_ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: mother.id, email: "aluno@weedu.com.br" } },
    update: {},
    create: {
      tenantId: mother.id,
      name: "Aluno de Teste",
      email: "aluno@weedu.com.br",
      passwordHash: await hash("aluno123"),
      role: "STUDENT",
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: daughter.id, email: "admin@clientedemo.com" } },
    update: {},
    create: {
      tenantId: daughter.id,
      name: "Admin Cliente Demo",
      email: "admin@clientedemo.com",
      passwordHash: await hash("cliente123"),
      role: "TENANT_ADMIN",
    },
  });

  // --- Trilha de demonstração --------------------------------------------
  // Recria do zero para manter o seed idempotente sem duplicar.
  await prisma.trilha.deleteMany({ where: { tenantId: mother.id, title: "Gestão de Resultados para PMEs" } });

  const trilha = await prisma.trilha.create({
    data: {
      tenantId: mother.id,
      title: "Gestão de Resultados para PMEs",
      description:
        "Fundamentos de metas, indicadores e lucratividade para pequenas e médias empresas.",
      published: true,
      order: 0,
      aulas: {
        create: [
          {
            title: "Boas-vindas e visão geral",
            description: "O que você vai aprender nesta trilha.",
            videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            order: 0,
          },
          {
            title: "Definindo metas SMART",
            description: "Como transformar objetivos em metas mensuráveis.",
            videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            order: 1,
          },
          {
            title: "Indicadores e lucratividade",
            description: "KPIs essenciais para acompanhar o resultado.",
            videoUrl: "https://vimeo.com/76979871",
            order: 2,
          },
        ],
      },
    },
  });

  // --- Prova: banco de 20 questões, sorteia 6 -----------------------------
  const exam = await prisma.exam.create({
    data: {
      trilhaId: trilha.id,
      title: "Avaliação final — Gestão de Resultados",
      questionsToShow: 6,
      passingScore: 70,
    },
  });

  const questions = Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    return {
      statement: `Questão ${n}: Qual alternativa melhor descreve a boa prática de gestão nº ${n}?`,
      order: i,
      options: {
        create: [
          { text: `Alternativa correta da questão ${n}`, isCorrect: true },
          { text: `Distrator A da questão ${n}`, isCorrect: false },
          { text: `Distrator B da questão ${n}`, isCorrect: false },
          { text: `Distrator C da questão ${n}`, isCorrect: false },
        ],
      },
    };
  });

  for (const q of questions) {
    await prisma.question.create({ data: { examId: exam.id, ...q } });
  }

  console.log("✅ Seed concluído.");
  console.log("   Mãe (Weedu):      admin@weedu.com.br / weedu123  (SUPER_ADMIN)");
  console.log("                     aluno@weedu.com.br / aluno123  (aluno)");
  console.log("   Filha (Demo):     admin@clientedemo.com / cliente123  (admin filha)");
  console.log(`   Trilha com banco de 20 questões (sorteia ${exam.questionsToShow}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

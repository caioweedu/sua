import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

// Popula o banco com os dados de demonstração. Reutilizado pelo script de
// seed (prisma/seed.ts) e pela rota /api/seed. Idempotente o suficiente:
// usa upsert para tenants/usuários e recria as trilhas da mãe.
export async function seedDatabase(prisma: PrismaClient) {
  const hash = (p: string) => bcrypt.hash(p, 10);

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

  const YT = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
  const VIMEO = "https://vimeo.com/76979871";
  const PDF =
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

  type AulaSeed = { title: string; description?: string; videoUrl?: string; pdfUrl?: string };
  type TrilhaSeed = {
    title: string;
    category: string;
    description: string;
    exam?: boolean;
    aulas: AulaSeed[];
  };

  const catalogo: TrilhaSeed[] = [
    {
      title: "Gestão de Resultados para PMEs",
      category: "Operações",
      description:
        "Fundamentos de metas, indicadores e lucratividade para pequenas e médias empresas.",
      exam: true,
      aulas: [
        { title: "Boas-vindas e visão geral", description: "O que você vai aprender nesta trilha.", videoUrl: YT },
        { title: "Definindo metas SMART", description: "Como transformar objetivos em metas mensuráveis.", videoUrl: YT, pdfUrl: PDF },
        { title: "Indicadores e lucratividade", description: "KPIs essenciais para acompanhar o resultado.", videoUrl: VIMEO },
      ],
    },
    {
      title: "Indicadores e Metas",
      category: "Operações",
      description: "O que são indicadores, como defini-los e acompanhá-los no dia a dia.",
      aulas: [
        { title: "O que são indicadores e metas", videoUrl: YT },
        { title: "Como reverter resultados negativos", videoUrl: YT },
        { title: "A importância do acompanhamento", videoUrl: VIMEO, pdfUrl: PDF },
      ],
    },
    {
      title: "Rotinas e Produtividade",
      category: "Operações",
      description: "Organize processos e ganhe consistência nas entregas da equipe.",
      aulas: [
        { title: "Padronizando rotinas", videoUrl: YT },
        { title: "Ferramentas de produtividade", videoUrl: VIMEO },
      ],
    },
    {
      title: "Liderança na Prática",
      category: "Gestores",
      description: "Desenvolva as competências essenciais para liderar times de alta performance.",
      aulas: [
        { title: "O papel do líder", videoUrl: YT },
        { title: "Feedback que desenvolve", videoUrl: YT, pdfUrl: PDF },
        { title: "Delegação eficaz", videoUrl: VIMEO },
      ],
    },
    {
      title: "Trabalho em Equipe",
      category: "Gestores",
      description: "Como construir colaboração, confiança e senso de dono no time.",
      aulas: [
        { title: "Fundamentos da colaboração", videoUrl: YT },
        { title: "Resolvendo conflitos", videoUrl: VIMEO },
      ],
    },
    {
      title: "Descobrindo as Causas dos Problemas",
      category: "Gestores",
      description: "Ishikawa, 5 Porquês e GUT para atacar a raiz — não o sintoma.",
      aulas: [
        { title: "O que são problemas e causas", videoUrl: YT },
        { title: "Diagrama de Ishikawa (espinha de peixe)", videoUrl: YT, pdfUrl: PDF },
        { title: "5 Porquês e matriz GUT", videoUrl: VIMEO },
      ],
    },
  ];

  // Recria as trilhas da mãe para manter o seed idempotente.
  await prisma.trilha.deleteMany({ where: { tenantId: mother.id } });

  let order = 0;
  for (const c of catalogo) {
    const trilha = await prisma.trilha.create({
      data: {
        tenantId: mother.id,
        title: c.title,
        description: c.description,
        category: c.category,
        published: true,
        order: order++,
        aulas: { create: c.aulas.map((au, i) => ({ ...au, order: i })) },
      },
    });

    if (c.exam) {
      const exam = await prisma.exam.create({
        data: {
          trilhaId: trilha.id,
          title: `Avaliação final — ${c.title}`,
          questionsToShow: 6,
          passingScore: 70,
        },
      });
      for (let i = 0; i < 20; i++) {
        const n = i + 1;
        await prisma.question.create({
          data: {
            examId: exam.id,
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
          },
        });
      }
    }
  }

  return { tenants: 2, trilhas: catalogo.length };
}

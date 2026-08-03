import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

// Popula o banco com os dados de demonstração na estrutura
// Vitrine → Produto (trilha) → Módulo → Aula.
// Reutilizado pelo script de seed e pela rota /api/seed.
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
  type ModuloSeed = { title: string; aulas: AulaSeed[] };
  type ProdutoSeed = { title: string; description: string; exam?: boolean; modulos: ModuloSeed[] };
  type VitrineSeed = { name: string; slug: string; description: string; produtos: ProdutoSeed[] };

  const vitrines: VitrineSeed[] = [
    {
      name: "Operações",
      slug: "operacoes",
      description: "Metas, indicadores e produtividade para o dia a dia.",
      produtos: [
        {
          title: "Gestão de Resultados para PMEs",
          description: "Fundamentos de metas, indicadores e lucratividade para PMEs.",
          exam: true,
          modulos: [
            {
              title: "Fundamentos",
              aulas: [
                { title: "Boas-vindas e visão geral", description: "O que você vai aprender nesta trilha.", videoUrl: YT },
                { title: "Definindo metas SMART", description: "Transformando objetivos em metas mensuráveis.", videoUrl: YT, pdfUrl: PDF },
              ],
            },
            {
              title: "Indicadores",
              aulas: [
                { title: "Indicadores e lucratividade", description: "KPIs essenciais para acompanhar o resultado.", videoUrl: VIMEO },
              ],
            },
          ],
        },
        {
          title: "Indicadores e Metas",
          description: "O que são indicadores, como defini-los e acompanhá-los.",
          modulos: [
            {
              title: "Conceitos",
              aulas: [
                { title: "O que são indicadores e metas", videoUrl: YT },
                { title: "A importância do acompanhamento", videoUrl: VIMEO, pdfUrl: PDF },
              ],
            },
          ],
        },
        {
          title: "Rotinas e Produtividade",
          description: "Organize processos e ganhe consistência nas entregas.",
          modulos: [
            {
              title: "Rotina",
              aulas: [
                { title: "Padronizando rotinas", videoUrl: YT },
                { title: "Ferramentas de produtividade", videoUrl: VIMEO },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "Gestores",
      slug: "gestores",
      description: "Liderança, times e resolução de problemas.",
      produtos: [
        {
          title: "Liderança na Prática",
          description: "Competências essenciais para liderar times de alta performance.",
          modulos: [
            {
              title: "O líder",
              aulas: [
                { title: "O papel do líder", videoUrl: YT },
                { title: "Feedback que desenvolve", videoUrl: YT, pdfUrl: PDF },
              ],
            },
            {
              title: "Na prática",
              aulas: [{ title: "Delegação eficaz", videoUrl: VIMEO }],
            },
          ],
        },
        {
          title: "Trabalho em Equipe",
          description: "Colaboração, confiança e senso de dono no time.",
          modulos: [
            {
              title: "Time",
              aulas: [
                { title: "Fundamentos da colaboração", videoUrl: YT },
                { title: "Resolvendo conflitos", videoUrl: VIMEO },
              ],
            },
          ],
        },
        {
          title: "Descobrindo as Causas dos Problemas",
          description: "Ishikawa, 5 Porquês e GUT para atacar a raiz.",
          modulos: [
            {
              title: "Ferramentas",
              aulas: [
                { title: "O que são problemas e causas", videoUrl: YT },
                { title: "Diagrama de Ishikawa", videoUrl: YT, pdfUrl: PDF },
                { title: "5 Porquês e matriz GUT", videoUrl: VIMEO },
              ],
            },
          ],
        },
      ],
    },
  ];

  // Recria a estrutura da mãe para manter o seed idempotente.
  await prisma.trilha.deleteMany({ where: { tenantId: mother.id } });
  await prisma.vitrine.deleteMany({ where: { tenantId: mother.id } });

  let vOrder = 0;
  let produtoCount = 0;
  for (const v of vitrines) {
    const vitrine = await prisma.vitrine.create({
      data: {
        tenantId: mother.id,
        name: v.name,
        slug: v.slug,
        description: v.description,
        published: true,
        order: vOrder++,
      },
    });

    let pOrder = 0;
    for (const p of v.produtos) {
      produtoCount++;
      const trilha = await prisma.trilha.create({
        data: {
          tenantId: mother.id,
          vitrineId: vitrine.id,
          title: p.title,
          description: p.description,
          category: v.name,
          published: true,
          order: pOrder++,
        },
      });

      let mOrder = 0;
      for (const m of p.modulos) {
        const modulo = await prisma.modulo.create({
          data: { trilhaId: trilha.id, title: m.title, order: mOrder++ },
        });
        let aOrder = 0;
        for (const au of m.aulas) {
          await prisma.aula.create({
            data: {
              trilhaId: trilha.id,
              moduloId: modulo.id,
              title: au.title,
              description: au.description,
              videoUrl: au.videoUrl,
              pdfUrl: au.pdfUrl,
              order: aOrder++,
            },
          });
        }
      }

      if (p.exam) {
        const exam = await prisma.exam.create({
          data: {
            trilhaId: trilha.id,
            title: `Avaliação final — ${p.title}`,
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
  }

  return { tenants: 2, vitrines: vitrines.length, produtos: produtoCount };
}

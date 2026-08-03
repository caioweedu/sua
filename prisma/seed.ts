import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/seedData";

const prisma = new PrismaClient();

async function main() {
  const res = await seedDatabase(prisma);
  console.log("✅ Seed concluído.");
  console.log("   Mãe (Weedu):      admin@weedu.com.br / weedu123  (SUPER_ADMIN)");
  console.log("                     aluno@weedu.com.br / aluno123  (aluno)");
  console.log("   Filha (Demo):     admin@clientedemo.com / cliente123  (admin filha)");
  console.log(`   ${res.vitrines} vitrines, ${res.produtos} produtos; 1 com prova (sorteia 6 de 20).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

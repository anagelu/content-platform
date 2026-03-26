import { PrismaClient } from "@prisma/client";

const DEFAULT_CATEGORY_NAMES = [
  "AI",
  "Trading",
  "Coding",
  "Job Hunting",
  "Theology",
  "Writing",
  "Business",
  "Life",
] as const;

const prisma = new PrismaClient();

async function main() {
  for (const name of DEFAULT_CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

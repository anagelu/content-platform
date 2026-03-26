import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORY_NAMES } from "@/lib/category-inference";

export async function ensureDefaultCategories() {
  await Promise.all(
    DEFAULT_CATEGORY_NAMES.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );
}

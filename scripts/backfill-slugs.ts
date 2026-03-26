import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});

const prisma = new PrismaClient({
  adapter,
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function main() {
  const posts = await prisma.post.findMany({
    orderBy: { id: "asc" },
  });

  for (const post of posts) {
    if (post.slug) continue;

    const baseSlug = slugify(post.title) || `post-${post.id}`;
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await prisma.post.findFirst({
        where: { slug },
      });

      if (!existing || existing.id === post.id) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { slug },
    });

    console.log(`Updated post ${post.id}: ${slug}`);
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

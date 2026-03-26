import { prisma } from "@/lib/prisma";
import { ensureDefaultCategories } from "@/lib/categories";
import Link from "next/link";

export default async function CategoriesPage() {
  await ensureDefaultCategories();

  const categories = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      posts: true,
    },
  });

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Categories</h1>
        <p className="page-subtitle">
          Explore your content by topic. Each category groups related posts
          together.
        </p>

        <div className="toolbar">
          <Link href="/posts" className="button-link">
            Back to Posts
          </Link>
          <Link href="/" className="button-link secondary">
            Home
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="card">
            <p>No categories yet.</p>
          </div>
        ) : (
          <ul className="card-list">
            {categories.map((category) => (
              <li key={category.id} className="card">
                <h2 className="card-title">
                  <Link
                    href={`/categories/${encodeURIComponent(category.name)}`}
                  >
                    {category.name}
                  </Link>
                </h2>

                <p className="meta">
                  {category.posts.length} post
                  {category.posts.length === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

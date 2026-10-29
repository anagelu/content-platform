import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ensureDefaultCategories } from "@/lib/categories";
import Link from "next/link";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse Pattern Foundry content by topic and category.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  await ensureDefaultCategories();

  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const isAdmin = session?.user?.role === "admin";

  const categories = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      posts: {
        where: isAdmin
          ? undefined
          : {
              OR: [
                { isPublic: true },
                ...(userId !== null ? [{ authorId: userId }] : []),
              ],
            },
      },
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

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  const category = await prisma.category.findUnique({
    where: { name: decodedName },
    select: { name: true, posts: { select: { id: true } } },
  });

  if (!category) {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  const url = `/categories/${encodeURIComponent(category.name)}`;
  const description = `${category.posts.length} post${category.posts.length === 1 ? "" : "s"} in ${category.name} on Pattern Foundry.`;

  return {
    title: category.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: category.name,
      description,
      url,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  const category = await prisma.category.findUnique({
    where: {
      name: decodedName,
    },
    include: {
      posts: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!category) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h1 className="page-title">Category not found</h1>
            <p className="page-subtitle">
              No category exists with that name.
            </p>
            <Link href="/categories" className="button-link">
              Back to Categories
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">{category.name}</h1>
        <p className="page-subtitle">
          {category.posts.length} post
          {category.posts.length === 1 ? "" : "s"} in this category.
        </p>

        <div className="toolbar">
          <Link href="/categories" className="button-link">
            Back to Categories
          </Link>
          <Link href="/posts" className="button-link secondary">
            All Posts
          </Link>
        </div>

        {category.posts.length === 0 ? (
          <div className="card">
            <p>No posts in this category yet.</p>
          </div>
        ) : (
          <ul className="card-list">
            {category.posts.map((post) => (
              <li key={post.id} className="card">
                <h2 className="card-title">
                  <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                </h2>

                <p className="meta">
                  Published {new Date(post.createdAt).toLocaleDateString()}
                </p>

                <p className="preview">
                  {post.body.slice(0, 180)}
                  {post.body.length > 180 ? "..." : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

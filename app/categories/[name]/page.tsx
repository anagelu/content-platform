import { prisma } from "@/lib/prisma";
import Link from "next/link";

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

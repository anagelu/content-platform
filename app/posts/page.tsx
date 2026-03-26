import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PostsPage() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      contentDerivatives: true,
    },
  });
  const conversationDerivedCount = posts.filter((post) => post.sourceChat?.trim()).length;
  const categorizedCount = posts.filter((post) => post.category).length;
  const derivativeCount = posts.reduce(
    (sum, post) => sum + post.contentDerivatives.length,
    0,
  );

  function estimateReadingMinutes(body: string) {
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  }

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Posts</h1>
        <p className="page-subtitle">
          Browse the publishing archive, including posts born from conversations and pieces that later expanded into broader assets.
        </p>

        <div className="toolbar">
          <Link href="/posts/new" className="button-link">
            Create New Post
          </Link>
          <Link href="/categories" className="button-link secondary">
            Browse Categories
          </Link>
          <Link href="/" className="button-link secondary">
            Home
          </Link>
        </div>

        <section className="posts-hero-band">
          <div className="posts-hero-card posts-hero-card-primary">
            <span className="posts-hero-kicker">Editorial Signal</span>
            <h2 className="card-title">This archive tracks what became durable enough to publish.</h2>
            <p className="preview">
              Posts here are not just isolated entries. Many start as conversations, get categorized, and then become source material for books, studio outputs, or follow-on derivatives.
            </p>
          </div>
          <div className="posts-hero-card">
            <span className="posts-hero-kicker">Archive Stats</span>
            <ul className="posts-hero-stats" aria-label="Post archive metrics">
              <li>
                <strong>{posts.length}</strong>
                <span>published posts</span>
              </li>
              <li>
                <strong>{conversationDerivedCount}</strong>
                <span>conversation-derived</span>
              </li>
              <li>
                <strong>{categorizedCount}</strong>
                <span>categorized entries</span>
              </li>
              <li>
                <strong>{derivativeCount}</strong>
                <span>linked derivatives</span>
              </li>
            </ul>
          </div>
        </section>

        {posts.length === 0 ? (
          <div className="card">
            <p>No posts yet.</p>
          </div>
        ) : (
          <ul className="card-list">
            {posts.map((post) => (
              <li key={post.id} className="card">
                <h2 className="card-title">
                  <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                </h2>

                <p className="meta">
                  Published {new Date(post.createdAt).toLocaleDateString()}
                </p>

                <div className="badge-row">
                  <span className="badge">{estimateReadingMinutes(post.body)} min read</span>
                  {post.sourceChat?.trim() ? (
                    <span className="badge">Derived from conversation</span>
                  ) : null}
                  {post.contentDerivatives.length > 0 ? (
                    <span className="badge">
                      {post.contentDerivatives.length} derivative
                      {post.contentDerivatives.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>

                <p className="meta">Votes: {post.votes}</p>

                {post.category && (
                  <div className="badge-row">
                    <Link
                      href={`/categories/${encodeURIComponent(post.category.name)}`}
                    >
                      <span className="badge">{post.category.name}</span>
                    </Link>
                  </div>
                )}

                <p className="preview">
                  {post.summary ||
                    `${post.body.slice(0, 180)}${
                      post.body.length > 180 ? "..." : ""
                    }`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

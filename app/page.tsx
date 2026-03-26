import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HomeIdeaStarter } from "./home-idea-starter";

const outputOptions = [
  {
    title: "Post",
    description: "Turn a raw conversation or note into something readable and publishable.",
    href: "/posts/new",
    action: "Convert to Post",
  },
  {
    title: "Book",
    description: "Shape a rough concept into a structured chapter or section draft.",
    href: "/books/new",
    action: "Convert to Book Section",
  },
  {
    title: "Patent Draft",
    description: "Move an invention idea into a clearer problem-solution filing frame.",
    href: "/patents/new",
    action: "Convert to Patent Draft",
  },
  {
    title: "Distribution Piece",
    description: "Rework a finished idea into a channel-ready derivative asset.",
    href: "/studio",
    action: "Convert to Distribution Asset",
  },
];

export default async function HomePage() {
  const session = await auth();
  const [posts, books, patents] = await Promise.all([
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
      },
      take: 3,
    }),
    prisma.book.findMany({
      where: {
        isPublic: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    session?.user?.id
      ? prisma.patentRecord.findMany({
          where:
            session.user.role === "admin"
              ? undefined
              : { authorId: Number(session.user.id) },
          orderBy: { updatedAt: "desc" },
          take: 2,
        })
      : Promise.resolve([]),
  ]);

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <div className="home-main">
          <section className="home-hero" id="overview">
            <div className="home-hero-copy">
              <p className="home-hero-kicker">Pattern Foundry</p>
              <h1 className="page-title">Turn rough ideas into durable assets.</h1>
              <p className="page-subtitle">
                Start messy. Refine later. Paste a conversation, note, or draft
                and turn it into a post, book section, patent draft, or
                distribution-ready asset without losing the thread of the idea.
              </p>
            </div>

            <div className="home-hero-panel">
              <p className="home-hero-panel-label">Core Flow</p>
              <ol className="home-flow-list">
                <li>Paste a conversation, note, or rough draft.</li>
                <li>Choose the output shape you want to create.</li>
                <li>Refine the draft section by section.</li>
                <li>Publish or distribute when the asset is ready.</li>
              </ol>
            </div>
          </section>

          <section id="start-with-an-idea" className="home-idea-section">
            <div className="home-section-heading">
              <p className="home-section-kicker">Step 1</p>
              <h2 className="trading-section-title">Capture the rough version first.</h2>
              <p className="meta">
                One entry point. Multiple durable outputs. This is the cleanest
                place to begin the product experience.
              </p>
            </div>

            <HomeIdeaStarter outputOptions={outputOptions} />
          </section>

          <section className="home-core-section">
            <div className="home-section-heading">
              <p className="home-section-kicker">Step 3</p>
              <h2 className="trading-section-title">Generate, refine, and turn the idea into something durable.</h2>
            </div>

            <div className="home-core-grid">
              <div className="card">
                <h3 className="card-title">Refine in structure, not in chaos</h3>
                <p className="preview">
                  Move from raw material into sections, chapters, or filing blocks so the idea gets stronger as it develops.
                </p>
              </div>
              <div className="card">
                <h3 className="card-title">Keep one source, create many assets</h3>
                <p className="preview">
                  A single strong idea can become a post, a manuscript section, a patent frame, and a distribution piece.
                </p>
              </div>
              <div className="card">
                <h3 className="card-title">Publish when the work is ready</h3>
                <p className="preview">
                  Finish the asset in the right workspace, then move into publishing or downstream distribution without starting over.
                </p>
              </div>
            </div>
          </section>

          <section className="home-secondary-section">
            <div className="home-section-heading">
              <p className="home-section-kicker">Recently Active</p>
              <h2 className="trading-section-title">Secondary systems stay available, but out of the way.</h2>
            </div>

            <div className="trading-detail-grid">
              <div className="card" style={{ marginBottom: 0 }}>
                <h3 className="card-title">Recent Posts</h3>
                {posts.length === 0 ? (
                  <p className="meta">No posts yet.</p>
                ) : (
                  <div className="home-compact-list">
                    {posts.map((post) => (
                      <Link key={post.id} href={`/posts/${post.slug}`} className="home-compact-link">
                        <strong>{post.title}</strong>
                        <span>
                          {post.category?.name || "Uncategorized"} · {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <h3 className="card-title">Draft Workspaces</h3>
                <div className="home-compact-list">
                  {books.map((book) => (
                    <Link key={book.id} href={`/books/${book.slug}`} className="home-compact-link">
                      <strong>{book.title}</strong>
                      <span>{book.bookType} · updated {new Date(book.updatedAt).toLocaleDateString()}</span>
                    </Link>
                  ))}
                  {session
                    ? patents.map((patent) => (
                        <Link key={patent.id} href={`/patents/${patent.slug}`} className="home-compact-link">
                          <strong>{patent.title}</strong>
                          <span>Patent draft · updated {new Date(patent.updatedAt).toLocaleDateString()}</span>
                        </Link>
                      ))
                    : null}
                  <div className="toolbar" style={{ marginTop: "0.8rem", marginBottom: 0 }}>
                    <Link href="/books" className="button-link secondary">
                      Books
                    </Link>
                    {session ? (
                      <>
                        <Link href="/trading" className="button-link secondary">
                          Trading
                        </Link>
                        <Link href="/inbox/messages" className="button-link secondary">
                          Inbox
                        </Link>
                      </>
                    ) : (
                      <Link href="/login" className="button-link secondary">
                        Sign In
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

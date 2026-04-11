import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HomeIdeaStarter, type OutputOption } from "./home-idea-starter";

const outputOptions: OutputOption[] = [
  {
    title: "Post",
    description: "Turn a raw conversation or note into something readable and publishable.",
    href: "/posts/new",
    action: "Convert to Post",
    previewKind: "post",
  },
  {
    title: "Book",
    description: "Shape a rough concept into a structured chapter or section draft.",
    href: "/books/new",
    action: "Convert to Book Section",
    previewKind: "book",
  },
  {
    title: "Patent Draft",
    description: "Move an invention idea into a clearer problem-solution filing frame.",
    href: "/patents/new",
    action: "Convert to Patent Draft",
    previewKind: "patent",
  },
  {
    title: "Distribution Piece",
    description: "Rework a finished idea into a channel-ready derivative asset.",
    href: "/studio",
    action: "Convert to Distribution Asset",
    previewKind: "distribution",
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
  const quickLinks = [
    { href: "/posts", label: "Posts", hint: "Publishing" },
    { href: "/books", label: "Books", hint: "Manuscripts" },
    { href: "/studio", label: "Studio", hint: "Distribution" },
    ...(session ? [{ href: "/trading", label: "Trading", hint: "Markets" }] : []),
    ...(session ? [{ href: "/inbox/messages", label: "Inbox", hint: "Capture" }] : []),
  ];
  const operatingLanes = [
    {
      kicker: "Capture",
      title: "Collect the rough material first",
      copy: "Bring in a conversation, note, journal fragment, or research thread before you decide what it should become.",
    },
    {
      kicker: "Shape",
      title: "Move the idea into a stronger form",
      copy: "Choose the right output and build it in a structured workspace instead of editing loose fragments.",
    },
    {
      kicker: "Compound",
      title: "Turn one source into multiple assets",
      copy: "Strong ideas can branch into posts, book sections, patent drafts, and distribution pieces without losing continuity.",
    },
  ];

  return (
    <main>
      <div className="home-page-shell">
        <div className="home-main">
          <section className="home-command-surface" id="overview">
            <div className="home-command-main">
              <p className="home-hero-kicker">Pattern Foundry</p>
              <h1 className="page-title">Build durable assets from rough thinking.</h1>
              <p className="page-subtitle">
                Capture first, structure second, publish later. Pattern Foundry gives each idea a workspace so it can
                evolve into writing, books, patents, distribution pieces, and trading workflows without losing continuity.
              </p>

              <div className="home-command-strip" aria-label="Primary workspaces">
                {quickLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="home-command-link">
                    <strong>{link.label}</strong>
                    <span>{link.hint}</span>
                  </Link>
                ))}
                {!session ? (
                  <Link href="/login" className="home-command-link is-accent">
                    <strong>Sign In</strong>
                    <span>Open your workspace</span>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="home-command-panel">
              <p className="home-hero-panel-label">Operating Model</p>
              <div className="home-command-metrics">
                <div>
                  <span>Capture</span>
                  <strong>Conversations, notes, fragments</strong>
                </div>
                <div>
                  <span>Shape</span>
                  <strong>Posts, books, patents, distribution</strong>
                </div>
                <div>
                  <span>Compound</span>
                  <strong>One source, many durable outputs</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="home-idea-section" id="start-with-an-idea">
            <div className="home-section-heading">
              <p className="home-section-kicker">Start Here</p>
              <h2 className="trading-section-title">Capture the rough version first.</h2>
              <p className="meta">
                Use the idea surface below to pick the right destination and keep the work moving inside a structured editor.
              </p>
            </div>

            <HomeIdeaStarter outputOptions={outputOptions} />
          </section>

          <section className="home-core-section">
            <div className="home-section-heading">
              <p className="home-section-kicker">Operating Lanes</p>
              <h2 className="trading-section-title">A clearer path from capture to finished work.</h2>
            </div>

            <div className="home-lane-grid">
              {operatingLanes.map((lane) => (
                <article key={lane.title} className="home-lane-card">
                  <p className="home-focus-kicker">{lane.kicker}</p>
                  <h3 className="card-title">{lane.title}</h3>
                  <p className="preview">{lane.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="home-secondary-section">
            <div className="home-section-heading">
              <p className="home-section-kicker">Recent Activity</p>
              <h2 className="trading-section-title">Live workspaces stay visible without overwhelming the page.</h2>
            </div>

            <div className="home-activity-grid">
              <section className="home-module">
                <div className="home-module-header">
                  <div>
                    <p className="home-focus-kicker">Publishing</p>
                    <h3 className="card-title">Recent Posts</h3>
                  </div>
                  <Link href="/posts" className="button-link secondary">
                    View All
                  </Link>
                </div>
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
              </section>

              <section className="home-module">
                <div className="home-module-header">
                  <div>
                    <p className="home-focus-kicker">Workspaces</p>
                    <h3 className="card-title">Drafts In Motion</h3>
                  </div>
                  <div className="toolbar" style={{ margin: 0 }}>
                    <Link href="/books" className="button-link secondary">
                      Books
                    </Link>
                    {session ? (
                      <Link href="/trading" className="button-link secondary">
                        Trading
                      </Link>
                    ) : null}
                  </div>
                </div>
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
                  {books.length === 0 && patents.length === 0 ? <p className="meta">No active drafts yet.</p> : null}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

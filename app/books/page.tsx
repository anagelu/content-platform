import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function BooksPage() {
  const session = await auth();
  const bookDelegate = (prisma as typeof prisma & {
    book?: {
      findMany: typeof prisma.book.findMany;
    };
  }).book;
  const books =
    (await bookDelegate?.findMany({
      where:
        session?.user?.role === "admin"
          ? undefined
          : session?.user?.id
            ? {
                OR: [
                  { authorId: Number(session.user.id) },
                  { isPublic: true },
                ],
              }
          : {
              isPublic: true,
            },
      include: {
        sections: {
          orderBy: { position: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    })) ?? [];

  return (
    <main>
      <div className="site-shell">
        <section className="section-command-surface">
          <div className="section-command-main">
            <p className="home-hero-kicker">Manuscript Workspace</p>
            <h1 className="page-title">Shape rough concepts into structured books.</h1>
            <p className="page-subtitle">
              Move beyond loose notes and build a manuscript with sections, sequencing, and a draft that can keep compounding.
            </p>
            <div className="section-command-strip">
              {session ? (
                <>
                  <Link href="/books/new" className="section-command-link is-accent">
                    <strong>Create Book</strong>
                    <span>Open a manuscript</span>
                  </Link>
                  <Link href="/posts/new" className="section-command-link">
                    <strong>Create Post</strong>
                    <span>Spin out an article</span>
                  </Link>
                </>
              ) : (
                <Link href="/login" className="section-command-link is-accent">
                  <strong>Sign In</strong>
                  <span>Start writing</span>
                </Link>
              )}
              <Link href="/" className="section-command-link">
                <strong>Home</strong>
                <span>Return to hub</span>
              </Link>
            </div>
          </div>

          <div className="section-command-panel">
            <p className="home-hero-panel-label">Library Status</p>
            <div className="home-command-metrics">
              <div>
                <span>Visible books</span>
                <strong>{books.length}</strong>
              </div>
              <div>
                <span>Public titles</span>
                <strong>{books.filter((book) => book.isPublic).length}</strong>
              </div>
              <div>
                <span>Total sections</span>
                <strong>{books.reduce((sum, book) => sum + book.sections.length, 0)}</strong>
              </div>
            </div>
          </div>
        </section>

        {books.length === 0 ? (
          <div className="card">
            <p>No books yet.</p>
          </div>
        ) : (
          <ul className="card-list">
            {books.map((book) => (
              <li key={book.id} className="card">
                <h2 className="card-title">
                  <Link href={`/books/${book.slug}`}>{book.title}</Link>
                </h2>
                <p className="meta">
                  {book.bookType}
                  {book.isPublic ? " · Public" : " · Private"}
                  {book.targetLength ? ` · ${book.targetLength}` : ""}
                  {book.audience ? ` · for ${book.audience}` : ""}
                </p>
                <p className="meta">
                  Updated {new Date(book.updatedAt).toLocaleDateString()} · {book.sections.length} section
                  {book.sections.length === 1 ? "" : "s"}
                </p>
                <p className="preview">
                  {book.summary ||
                    `${book.sourceDraft.slice(0, 180)}${book.sourceDraft.length > 180 ? "..." : ""}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { deleteBook, setBookVisibility } from "../actions";
import { BookReaderWorkspace } from "../book-reader-workspace";

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;
  const book = await prisma.book.findUnique({
    where: { slug },
    include: {
      author: true,
      sections: {
        where: {
          parentSectionId: null,
        },
        orderBy: { position: "asc" },
        include: {
          subsections: {
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!book) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h1 className="page-title">Book not found</h1>
            <Link href="/books" className="button-link">
              Back to Books
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const userId = session?.user?.id ? Number(session.user.id) : null;
  const canManage =
    session?.user?.role === "admin" ||
    (userId !== null && book.authorId === userId);
  const canView = Boolean(book.isPublic || canManage);

  if (!canView) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h1 className="page-title">This book is private</h1>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <Link href="/books" className="button-link secondary">
                Back to Books
              </Link>
              <Link href="/login" className="button-link">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <article className="book-page-shell">
          <section className="book-page-hero">
            <div className="book-page-hero-copy">
              <p className="book-page-kicker">Reading Copy</p>
              <h1 className="article-title book-page-title">{book.title}</h1>
              <p className="book-page-meta">
                {book.bookType}
                {book.isPublic ? " · Public" : ""}
                {book.targetLength ? ` · ${book.targetLength}` : ""}
                {book.tone ? ` · ${book.tone}` : ""}
              </p>
              <p className="book-page-meta">
                By {book.author.name ?? book.author.username} · Updated{" "}
                {new Date(book.updatedAt).toLocaleDateString()}
              </p>

              {book.summary ? <p className="book-page-summary">{book.summary}</p> : null}

              <div className="article-actions">
                <Link href="/books" className="button-link secondary">
                  Back to Books
                </Link>
                {canManage ? (
                  <>
                    <form action={setBookVisibility}>
                      <input type="hidden" name="id" value={book.id} />
                      <input type="hidden" name="isPublic" value={book.isPublic ? "false" : "true"} />
                      <button type="submit" className="button-link secondary">
                        {book.isPublic ? "Make Private" : "Make Public"}
                      </button>
                    </form>
                    <Link href={`/books/${book.slug}/edit`} className="button-link secondary">
                      Edit
                    </Link>
                    <form action={deleteBook}>
                      <input type="hidden" name="id" value={book.id} />
                      <button type="submit" className="delete-button">
                        Delete
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>

            <aside className="book-page-hero-note">
              <p className="book-page-note-kicker">Book Feel</p>
              <h2 className="book-page-note-title">Designed to read like pages, not panels.</h2>
              <p className="book-page-note-body">
                Move through the manuscript section by section, keep your place, and let the
                reading surface hold more of the pacing and atmosphere of the book itself.
              </p>
            </aside>
          </section>

          <BookReaderWorkspace
            outline={book.outline}
            sections={book.sections}
            characterProfilesJson={book.characterProfilesJson}
            settingProfilesJson={book.settingProfilesJson}
          />
        </article>
      </div>
    </main>
  );
}

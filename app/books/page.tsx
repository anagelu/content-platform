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
        <h1 className="page-title">Books</h1>
        <p className="page-subtitle">
          Turn rough drafts into a structured, editable manuscript with an outline you can keep refining.
        </p>

        <div className="toolbar">
          {session ? (
            <>
              <Link href="/books/new" className="button-link">
                Create New Book
              </Link>
              <Link href="/posts/new" className="button-link secondary">
                Create New Post
              </Link>
            </>
          ) : (
            <Link href="/login" className="button-link">
              Sign In To Create
            </Link>
          )}
          <Link href="/" className="button-link secondary">
            Home
          </Link>
        </div>

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

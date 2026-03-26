import { auth } from "@/auth";
import { prismaWithJournal } from "@/lib/prisma-journal";
import { formatPrice } from "@/lib/trading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteTradingJournalEntry } from "./actions";

export default async function TradingJournalEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { slug } = await params;

  const entry = await prismaWithJournal.tradingJournalEntry.findUnique({
    where: {
      slug,
    },
    include: {
      author: true,
    },
  });

  if (!entry) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h2 className="page-title">Journal entry not found</h2>
            <Link href="/trading/journal" className="button-link secondary">
              Back to Journal
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const canView =
    session.user.role === "admin" || session.user.id === String(entry.authorId);
  const isStillHolding = !entry.exitDate && !entry.exitPrice;

  if (!canView) {
    redirect("/trading/journal");
  }

  return (
    <main>
      <div className="site-shell">
        <article className="article-card">
          <h1 className="article-title">{entry.title}</h1>
          <div className="badge-row">
            <span className="badge">{entry.market}</span>
            <span className="badge">{entry.timeframe}</span>
            <span className="badge">{entry.direction}</span>
            <span className="badge">{isStillHolding ? "Still Holding" : "Closed"}</span>
          </div>

          <p className="meta">
            By {entry.author.name ?? entry.author.username}
          </p>
          <p className="article-summary">{entry.summary}</p>

          <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Entry date</span>
              <strong>{new Date(entry.entryDate).toLocaleDateString()}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Entry price</span>
              <strong>{formatPrice(entry.entryPrice)}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Exit price</span>
              <strong>
                {isStillHolding
                  ? "Still holding"
                  : entry.exitPrice
                    ? formatPrice(entry.exitPrice)
                    : "Closed / not logged"}
              </strong>
            </div>
          </div>

          {entry.exitDate ? (
            <p className="meta" style={{ marginTop: "1rem" }}>
              Exit date: {new Date(entry.exitDate).toLocaleDateString()}
            </p>
          ) : isStillHolding ? (
            <p className="meta" style={{ marginTop: "1rem" }}>
              Status: position is still open.
            </p>
          ) : null}

          <div className="trading-detail-grid">
            <section className="card">
              <h2 className="trading-section-title">Execution Notes</h2>
              <p>{entry.executionNotes || "No execution notes yet."}</p>
            </section>

            <section className="card">
              <h2 className="trading-section-title">Mistake Review</h2>
              <p>{entry.mistakeReview || "No mistake review yet."}</p>
            </section>
          </div>

          <section className="card">
            <h2 className="trading-section-title">Lesson Learned</h2>
            <p>{entry.lessonLearned || "No lesson captured yet."}</p>
          </section>

          <div className="toolbar">
            <Link href="/trading/journal" className="button-link secondary">
              Back to Journal
            </Link>
            <Link href="/trading" className="button-link secondary">
              Trading Home
            </Link>
            {canView ? (
              <>
                <Link
                  href={`/trading/journal/${entry.slug}/edit`}
                  className="button-link secondary"
                >
                  Edit
                </Link>
                <form action={deleteTradingJournalEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" className="delete-button">
                    Delete
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </article>
      </div>
    </main>
  );
}

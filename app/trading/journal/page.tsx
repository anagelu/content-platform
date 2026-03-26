import { auth } from "@/auth";
import { prismaWithJournal } from "@/lib/prisma-journal";
import type { TradingJournalEntry, User } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TradingJournalPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);
  const entries = (await prismaWithJournal.tradingJournalEntry.findMany({
    where: session.user.role === "admin" ? undefined : { authorId: userId },
    include: {
      author: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })) as Array<TradingJournalEntry & { author: User }>;
  const spxEntries = entries.filter((entry) => entry.market.trim().toUpperCase() === "SPX");

  return (
    <main>
      <div className="site-shell">
        <h1 className="page-title">Trading Journal</h1>
        <p className="page-subtitle">
          Review executed trades, capture mistakes, and turn results into a
          repeatable process improvement loop.
        </p>

        <div className="toolbar">
          <Link href="/trading/journal/new" className="button-link">
            New Journal Entry
          </Link>
          <Link href="/trading" className="button-link secondary">
            Trading Home
          </Link>
        </div>

        <section className="trading-hero-card" style={{ marginBottom: "2rem" }}>
          <h2 className="trading-section-title">SPX Review Loop</h2>
          <p>
            {spxEntries.length === 0
              ? "Use the journal to score your SPX process after each trade, especially around opening range, trend-day continuation, and failed fade attempts."
              : `${spxEntries.length} SPX review${spxEntries.length === 1 ? "" : "s"} recorded so far. Keep focusing on repeatable mistakes and time-of-day behavior.`}
          </p>
        </section>

        {entries.length === 0 ? (
          <div className="card">
            <p>No journal entries yet.</p>
          </div>
        ) : (
          <ul className="card-list">
            {entries.map((entry) => (
              <li key={entry.id} className="card">
                <h2 className="card-title">
                  <Link href={`/trading/journal/${entry.slug}`}>{entry.title}</Link>
                </h2>
                <p className="meta">
                  {entry.market} · {entry.timeframe} · {entry.direction} ·{" "}
                  {new Date(entry.entryDate).toLocaleDateString()}
                </p>
                <p className="meta">
                  {!entry.exitDate && !entry.exitPrice ? "Still holding" : "Closed"}
                </p>
                <p className="meta">
                  By {entry.author.name ?? entry.author.username}
                </p>
                <p className="preview">{entry.summary}</p>
                <div className="toolbar" style={{ marginBottom: 0 }}>
                  <Link
                    href={`/trading/journal/${entry.slug}`}
                    className="button-link secondary"
                  >
                    Open Entry
                  </Link>
                  <Link
                    href={`/trading/journal/${entry.slug}/edit`}
                    className="button-link secondary"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

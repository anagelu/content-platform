import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { prismaWithJournal } from "@/lib/prisma-journal";
import { buildSpxTradingOverview } from "@/lib/trading";
import Link from "next/link";

function formatPersonalizedOverview(sessions: Array<{
  market: string;
  timeframe: string;
  setupType: string;
}>) {
  if (sessions.length === 0) {
    return "No trading sessions yet. Your personalized workflow will start taking shape after your first few ideas.";
  }

  const topMarket =
    Object.entries(
      sessions.reduce<Record<string, number>>((acc, session) => {
        acc[session.market] = (acc[session.market] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? sessions[0].market;

  const topTimeframe =
    Object.entries(
      sessions.reduce<Record<string, number>>((acc, session) => {
        acc[session.timeframe] = (acc[session.timeframe] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? sessions[0].timeframe;

  return `Your current trading footprint leans toward ${topMarket} ideas on the ${topTimeframe} timeframe. As sessions and upvotes accumulate, this area can become a sharper personalized workflow engine.`;
}

const spxFastActions = [
  {
    title: "Build ORB Plan",
    description: "Open a fresh SPX session with an opening-range break preset and 5m chart context.",
    href: "/trading/new?market=SPX&preset=orb",
    variant: "primary",
  },
  {
    title: "Map Trend Day",
    description: "Start an SPX continuation plan when you want to stay with directional strength.",
    href: "/trading/new?market=SPX&preset=trend",
    variant: "secondary",
  },
  {
    title: "Log SPX Review",
    description: "Jump into a journal entry with SPX review, mistake-audit, and lesson templates ready.",
    href: "/trading/journal/new?market=SPX&preset=review",
    variant: "secondary",
  },
  {
    title: "Open SPX Chart",
    description: "Pop open the chart workspace directly on SPX 5m so levels and session structure are visible fast.",
    href: "/trading/chart?market=SPX&timeframe=5m",
    variant: "secondary",
  },
];

export default async function TradingPage() {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const tradingJournalEntryDelegate = (
    prismaWithJournal as typeof prismaWithJournal & {
      tradingJournalEntry?: {
        findMany: typeof prismaWithJournal.tradingJournalEntry.findMany;
      };
    }
  ).tradingJournalEntry;

  const [mySessions, myJournalEntries, publicSessions] = await Promise.all([
    userId
      ? prisma.tradingSession.findMany({
          where: {
            authorId: userId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 6,
        })
      : Promise.resolve([]),
    userId
      ? tradingJournalEntryDelegate?.findMany({
          where: {
            authorId: userId,
          },
          select: {
            market: true,
            direction: true,
          },
        }) ?? Promise.resolve([])
      : Promise.resolve([]),
    prisma.tradingSession.findMany({
      where: {
        featuredPublic: true,
        author: {
          publicTradingProfile: true,
        },
      },
      include: {
        author: true,
      },
      orderBy: [
        { votes: "desc" },
        { createdAt: "desc" },
      ],
      take: 6,
    }),
  ]);
  const spxOverview = buildSpxTradingOverview({
    sessions: mySessions,
    journalEntries: myJournalEntries,
  });

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Trading Workspace</h1>
        <p className="page-subtitle">
          Collate trading ideas, let your workflow evolve across repeated
          sessions, and selectively push your best frameworks into a credited
          public showcase.
        </p>

        <div className="toolbar">
          <Link href="/trading/new" className="button-link">
            New Trading Session
          </Link>
          <Link href="/trading/journal" className="button-link secondary">
            Trading Journal
          </Link>
          <Link href="/trading/tools" className="button-link secondary">
            Open Tools
          </Link>
          <Link href="/trading/algo" className="button-link secondary">
            Algo Workspace
          </Link>
          <Link href="/trading/screener" className="button-link secondary">
            Screener
          </Link>
          <Link href="/trading/recommendations" className="button-link secondary">
            Recommendations
          </Link>
          <Link href="/trading/pipeline" className="button-link secondary">
            Pipeline
          </Link>
          <Link href="/" className="button-link secondary">
            Home
          </Link>
        </div>

        {session ? (
          <section className="trading-hero-card">
            <h2 className="trading-section-title">Your evolving edge</h2>
            <p>{formatPersonalizedOverview(mySessions)}</p>
            <p className="meta">
              {mySessions.length} session{mySessions.length === 1 ? "" : "s"} in
              your workspace
            </p>
          </section>
        ) : (
          <section className="trading-hero-card">
            <h2 className="trading-section-title">Private workspace, public upside</h2>
            <p>
              Sign in to build a trading workflow that gets more personalized as
              your sessions grow. Public-ready ideas can later be featured with
              credit.
            </p>
          </section>
        )}

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">SPX Focus Loop</h2>
          <div className="trading-detail-grid">
            <div className="card" style={{ marginBottom: 0 }}>
              <h3 className="card-title">Process Snapshot</h3>
              <p className="meta">
                {spxOverview.totalSessions} SPX session
                {spxOverview.totalSessions === 1 ? "" : "s"} tracked
              </p>
              <p className="preview">
                {spxOverview.resolvedSessions > 0
                  ? `${spxOverview.winRate.toFixed(1)}% of resolved SPX ideas reached target or partial outcome.`
                  : "Resolve a few SPX ideas to start seeing hit-rate feedback."}
              </p>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3 className="card-title">Most Repeated Pattern</h3>
              <p className="meta">{spxOverview.topSetup}</p>
              <p className="preview">
                Primary decision timeframe: {spxOverview.topTimeframe}. Average confidence:{" "}
                {spxOverview.averageConfidence > 0
                  ? `${spxOverview.averageConfidence.toFixed(1)}/10`
                  : "not enough data yet"}.
              </p>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3 className="card-title">Review Discipline</h3>
              <p className="meta">
                {spxOverview.journalCount} SPX journal entr
                {spxOverview.journalCount === 1 ? "y" : "ies"}
              </p>
              <p className="preview">
                Pair every SPX idea with a journal review so the edge comes from repeatability, not just signal quality.
              </p>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3 className="card-title">Fast Actions</h3>
              <p className="meta">
                Move from idea to review without rebuilding the same SPX workflow every session.
              </p>
              <div className="spx-action-grid">
                {spxFastActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`spx-action-card${action.variant === "primary" ? " spx-action-card-primary" : ""}`}
                  >
                    <span className="spx-action-title">{action.title}</span>
                    <span className="spx-action-description">{action.description}</span>
                  </Link>
                ))}
              </div>
              <div className="toolbar" style={{ marginTop: "1rem", marginBottom: 0 }}>
                <Link href="/trading/recommendations/SPX" className="button-link secondary">
                  SPX Read
                </Link>
                <Link href="/trading/journal" className="button-link secondary">
                  Review Loop
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Journal Loop</h2>
          <div className="card">
            <p className="preview">
              Capture executed trades separately from setup ideas. Use the
              journal to review execution, mistakes, and lessons learned so the
              next session gets better.
            </p>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <Link href="/trading/journal" className="button-link secondary">
                Open Journal
              </Link>
              <Link href="/trading/journal/new" className="button-link">
                New Journal Entry
              </Link>
            </div>
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Recent Trading Sessions</h2>
          {mySessions.length === 0 ? (
            <div className="card">
              <p>No trading sessions yet.</p>
            </div>
          ) : (
            <ul className="card-list">
              {mySessions.map((tradingSession) => (
                <li key={tradingSession.id} className="card">
                  <h3 className="card-title">
                    <Link href={`/trading/${tradingSession.slug}`}>
                      {tradingSession.title}
                    </Link>
                  </h3>
                  <p className="meta">
                    <Link
                      href={`/trading/recommendations/${encodeURIComponent(
                        tradingSession.market,
                      )}`}
                    >
                      {tradingSession.market}
                    </Link>{" "}
                    · {tradingSession.timeframe} · {tradingSession.setupType}
                  </p>
                  <p className="preview">{tradingSession.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Public Trading Frameworks</h2>
          {publicSessions.length === 0 ? (
            <div className="card">
              <p>No public trading frameworks yet.</p>
            </div>
          ) : (
            <ul className="card-list">
              {publicSessions.map((tradingSession) => (
                <li key={tradingSession.id} className="card">
                  <h3 className="card-title">
                    <Link href={`/trading/${tradingSession.slug}`}>
                      {tradingSession.title}
                    </Link>
                  </h3>
                  <p className="meta">
                    By {tradingSession.author.name ?? tradingSession.author.username}
                  </p>
                  <p className="meta">
                    <Link
                      href={`/trading/recommendations/${encodeURIComponent(
                        tradingSession.market,
                      )}`}
                    >
                      {tradingSession.market}
                    </Link>{" "}
                    · {tradingSession.timeframe} · Votes {tradingSession.votes}
                  </p>
                  <p className="preview">{tradingSession.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

import { prisma } from "@/lib/prisma";
import { getMarketQuote } from "@/lib/market-data";
import {
  buildMarketRecommendationSummary,
  buildTimeframeRecommendationSummary,
  formatPrice,
} from "@/lib/trading";
import Link from "next/link";

export default async function MarketRecommendationDetailPage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await params;

  const sessions = await prisma.tradingSession.findMany({
    where: {
      market,
    },
    include: {
      author: true,
    },
    orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
  });
  const quote = await getMarketQuote(market);

  if (sessions.length === 0) {
    return (
      <main>
        <div className="site-shell site-shell-wide">
          <div className="card">
            <h2 className="page-title">No recommendations yet</h2>
            <Link href="/trading/recommendations" className="button-link secondary">
              Back to Recommendations
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const groupedByTimeframe = Object.entries(
    sessions.reduce<Record<string, typeof sessions>>((acc, session) => {
      acc[session.timeframe] = [...(acc[session.timeframe] ?? []), session];
      return acc;
    }, {}),
  );
  const marketSummary = buildMarketRecommendationSummary(sessions);
  const weightedEntryMid =
    (marketSummary.weightedEntryMin + marketSummary.weightedEntryMax) / 2;

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">{market} Recommendations</h1>
        <p className="page-subtitle">
          Structured community entry and exit ranges grouped by timeframe. The
          recommendation engine now leans on confidence, outcomes, and community
          participation instead of a flat average.
        </p>

        {quote ? (
          <section className="trading-hero-card" style={{ marginBottom: "1.5rem" }}>
            <h2 className="trading-section-title">Live Quote</h2>
            <div className="trading-metric-row">
              <div className="trading-metric-card">
                <span className="trading-metric-label">Current Price</span>
                <strong>{formatPrice(quote.price)}</strong>
              </div>
              <div className="trading-metric-card">
                <span className="trading-metric-label">Daily Change</span>
                <strong>
                  {formatPrice(quote.change)} ({quote.changePercent.toFixed(2)}%)
                </strong>
              </div>
              <div className="trading-metric-card">
                <span className="trading-metric-label">Previous Close</span>
                <strong>{formatPrice(quote.previousClose)}</strong>
              </div>
            </div>
            <p className="meta" style={{ marginTop: "0.75rem" }}>
              Latest market day: {quote.fetchedAt}
            </p>
          </section>
        ) : null}

        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 className="trading-section-title">Weighted Community Read</h2>
          <div className="trading-metric-row">
            <div className="trading-metric-card">
              <span className="trading-metric-label">Direction bias</span>
              <strong>{marketSummary.directionBias}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Best-supported timeframe</span>
              <strong>{marketSummary.bestTimeframe}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Weighted confidence</span>
              <strong>{marketSummary.weightedConfidence.toFixed(1)}/10</strong>
            </div>
          </div>
          <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Weighted entry zone</span>
              <strong>
                {formatPrice(marketSummary.weightedEntryMin)} -{" "}
                {formatPrice(marketSummary.weightedEntryMax)}
              </strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Weighted invalidation</span>
              <strong>{formatPrice(marketSummary.weightedStop)}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Weighted target</span>
              <strong>{formatPrice(marketSummary.weightedTarget)}</strong>
            </div>
          </div>
          <p className="meta" style={{ marginTop: "1rem" }}>
            {sessions.length} sessions are contributing to this view. Sessions
            with stronger outcomes, more conviction, and more community support
            carry more weight.
          </p>
          {quote ? (
            <p className="meta">
              Current price vs weighted entry midpoint:{" "}
              {formatPrice(quote.price - weightedEntryMid)}
            </p>
          ) : null}
        </section>

        <div className="toolbar">
          <Link href="/trading/recommendations" className="button-link secondary">
            Back to Recommendations
          </Link>
          <Link href="/trading/new" className="button-link">
            New Trading Session
          </Link>
        </div>

        {groupedByTimeframe.map(([timeframe, timeframeSessions]) => {
          const timeframeSummary =
            buildTimeframeRecommendationSummary(timeframeSessions);
          const weightedTimeframeEntryMid =
            (timeframeSummary.weightedEntryMin +
              timeframeSummary.weightedEntryMax) /
            2;

          return (
            <section key={timeframe} className="card" style={{ marginBottom: "1rem" }}>
              <h2 className="trading-section-title">{timeframe}</h2>
              <div className="trading-metric-row">
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Weighted entry zone</span>
                  <strong>
                    {formatPrice(timeframeSummary.weightedEntryMin)} -{" "}
                    {formatPrice(timeframeSummary.weightedEntryMax)}
                  </strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Weighted invalidation</span>
                  <strong>{formatPrice(timeframeSummary.weightedStop)}</strong>
                </div>
                <div className="trading-metric-card">
                  <span className="trading-metric-label">Weighted target</span>
                  <strong>{formatPrice(timeframeSummary.weightedTarget)}</strong>
                </div>
              </div>

              <p className="meta" style={{ marginTop: "1rem" }}>
                {timeframeSessions.length} sessions · bias{" "}
                {timeframeSummary.directionBias} · weighted confidence{" "}
                {timeframeSummary.weightedConfidence.toFixed(1)}/10
              </p>

              {quote ? (
                <p className="meta">
                  Current price vs weighted entry midpoint:{" "}
                  {formatPrice(quote.price - weightedTimeframeEntryMid)}
                </p>
              ) : null}

              <ul className="card-list" style={{ marginTop: "1rem" }}>
                {timeframeSessions.slice(0, 5).map((session) => (
                  <li key={session.id} className="card">
                    <h3 className="card-title">
                      <Link href={`/trading/${session.slug}`}>{session.title}</Link>
                    </h3>
                    <p className="meta">
                      {session.direction} · {session.setupType} · by{" "}
                      {session.author.name ?? session.author.username}
                    </p>
                    <p className="preview">{session.summary}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

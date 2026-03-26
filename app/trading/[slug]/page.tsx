import { prisma } from "@/lib/prisma";
import { getTradingChartContext } from "@/lib/trading-chart-context";
import { getMarketQuote } from "@/lib/market-data";
import { formatPrice } from "@/lib/trading";
import { parseTradingSetupContext } from "@/lib/trading-setups";
import Link from "next/link";
import { auth } from "@/auth";
import { deleteTradingSession } from "./actions";

export default async function TradingSessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;

  const tradingSession = await prisma.tradingSession.findUnique({
    where: {
      slug,
    },
    include: {
      author: true,
    },
  });
  const chartContext = tradingSession
    ? await getTradingChartContext(tradingSession.id)
    : null;
  const quote = tradingSession
    ? await getMarketQuote(tradingSession.market)
    : null;

  if (!tradingSession) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h2 className="page-title">Trading session not found</h2>
            <Link href="/trading" className="button-link">
              Back to Trading
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const canView =
    session?.user?.role === "admin" ||
    session?.user?.id === String(tradingSession.authorId) ||
    (tradingSession.featuredPublic && tradingSession.author.publicTradingProfile);
  const canManage =
    session?.user?.role === "admin" ||
    session?.user?.id === String(tradingSession.authorId);
  const setupContext = parseTradingSetupContext(tradingSession.setupContext);

  if (!canView) {
    return (
      <main>
        <div className="site-shell">
          <div className="card">
            <h2 className="page-title">Private Trading Session</h2>
            <p>This session is not public yet.</p>
            <Link href="/trading" className="button-link secondary">
              Back to Trading
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="site-shell">
        <article className="article-card">
          <h1 className="article-title">{tradingSession.title}</h1>

          <div className="badge-row">
            <span className="badge">{tradingSession.market}</span>{" "}
            <span className="badge">{tradingSession.timeframe}</span>{" "}
            <span className="badge">{tradingSession.setupType}</span>
            <span className="badge">{tradingSession.direction}</span>
          </div>

          <p className="meta">
            By {tradingSession.author.name ?? tradingSession.author.username}
          </p>
          <p className="meta">Votes: {tradingSession.votes}</p>
          <p className="meta">Suggestions: {tradingSession.suggestionCount}</p>
          <p className="meta">
            Confidence: {tradingSession.confidence}/10 · Outcome:{" "}
            {tradingSession.outcome.replaceAll("_", " ").toLowerCase()}
          </p>

          <p className="article-summary">{tradingSession.summary}</p>

          {quote ? (
            <div className="trading-insight-card">
              <h2 className="trading-section-title">Live Market Snapshot</h2>
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
                  <span className="trading-metric-label">Distance to Entry Mid</span>
                  <strong>
                    {formatPrice(
                      quote.price -
                        (tradingSession.entryMin + tradingSession.entryMax) / 2,
                    )}
                  </strong>
                </div>
              </div>
              <p className="meta" style={{ marginTop: "0.75rem" }}>
                Latest market day: {quote.fetchedAt}
              </p>
            </div>
          ) : null}

          <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Entry Zone</span>
              <strong>
                {formatPrice(tradingSession.entryMin)} -{" "}
                {formatPrice(tradingSession.entryMax)}
              </strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Stop Loss</span>
              <strong>{formatPrice(tradingSession.stopLoss)}</strong>
            </div>
            <div className="trading-metric-card">
              <span className="trading-metric-label">Target One</span>
              <strong>{formatPrice(tradingSession.targetOne)}</strong>
            </div>
          </div>

          {tradingSession.targetTwo ? (
            <div className="trading-metric-row" style={{ marginTop: "1rem" }}>
              <div className="trading-metric-card">
                <span className="trading-metric-label">Target Two</span>
                <strong>{formatPrice(tradingSession.targetTwo)}</strong>
              </div>
            </div>
          ) : null}

          {tradingSession.personalizedInsight ? (
            <div className="trading-insight-card">
              <h2 className="trading-section-title">Personalized Insight</h2>
              <p>{tradingSession.personalizedInsight}</p>
            </div>
          ) : null}

          {chartContext?.screenshotUrl || chartContext?.chartNotes ? (
            <section className="card">
              <div className="comments-header">
                <h2 className="trading-section-title">Chart Context</h2>
                <Link
                  href={`/trading/chart?market=${encodeURIComponent(
                    tradingSession.market,
                  )}&timeframe=${encodeURIComponent(
                    chartContext?.chartTimeframe || tradingSession.timeframe,
                  )}`}
                  target="_blank"
                  className="button-link secondary"
                >
                  Open Chart View
                </Link>
              </div>

              {chartContext?.screenshotUrl ? (
                <div className="trading-chart-image-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={chartContext.screenshotUrl}
                    alt={`${tradingSession.market} chart screenshot`}
                    className="trading-chart-image"
                  />
                </div>
              ) : null}

              {chartContext?.chartTimeframe ? (
                <p className="meta">
                  Chart timeframe: {chartContext.chartTimeframe}
                </p>
              ) : null}

              {chartContext?.chartNotes ? (
                <p>{chartContext.chartNotes}</p>
              ) : null}
            </section>
          ) : null}

          {setupContext ? (
            <section className="card">
              <h2 className="trading-section-title">Setup Data</h2>
              <div className="trading-detail-grid">
                {setupContext.entries.map((entry) => (
                  <div key={entry.key} className="trading-metric-card">
                    <span className="trading-metric-label">{entry.label}</span>
                    <strong>{entry.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="trading-detail-grid">
            <section className="card">
              <h2 className="trading-section-title">Thesis</h2>
              <p>{tradingSession.thesis}</p>
            </section>

            <section className="card">
              <h2 className="trading-section-title">Workflow Notes</h2>
              <p>{tradingSession.workflowNotes || "No workflow notes yet."}</p>
            </section>
          </div>

          {tradingSession.sourceChat ? (
            <section className="card">
              <h2 className="trading-section-title">Source Session</h2>
              <pre className="trading-source-chat">{tradingSession.sourceChat}</pre>
            </section>
          ) : null}

          <div className="toolbar">
            <Link href="/trading" className="button-link secondary">
              Back to Trading
            </Link>
            <Link
              href={`/trading/recommendations/${encodeURIComponent(
                tradingSession.market,
              )}`}
              className="button-link secondary"
            >
              Market Recommendations
            </Link>
            <Link href="/trading/tools" className="button-link secondary">
              Open Tools
            </Link>
            <Link
              href={`/trading/chart?market=${encodeURIComponent(
                tradingSession.market,
              )}&timeframe=${encodeURIComponent(
                chartContext?.chartTimeframe || tradingSession.timeframe,
              )}`}
              target="_blank"
              className="button-link secondary"
            >
              Open Chart View
            </Link>
            {canManage ? (
              <>
                <Link
                  href={`/trading/${tradingSession.slug}/edit`}
                  className="button-link secondary"
                >
                  Edit
                </Link>
                <form action={deleteTradingSession}>
                  <input type="hidden" name="id" value={tradingSession.id} />
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

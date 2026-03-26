import Link from "next/link";
import { getRankedScreenerPicks } from "@/lib/alpaca-screener";

function formatMoney(value: number | null) {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

function formatCompactNumber(value: number | null) {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function TradingScreenerPage() {
  const screener = await getRankedScreenerPicks();

  return (
    <main>
      <div className="site-shell site-shell-wide">
        <h1 className="page-title">Alpaca Screener</h1>
        <p className="page-subtitle">
          Turn Alpaca movers and activity data into a simple ranked watchlist,
          then jump straight into the algo workspace when a symbol deserves
          more attention.
        </p>

        <div className="toolbar">
          <Link href="/trading" className="button-link secondary">
            Back to Trading
          </Link>
          <Link href="/trading/algo" className="button-link secondary">
            Algo Workspace
          </Link>
          <Link href="/trading/screener" className="button-link">
            Refresh Picks
          </Link>
        </div>

        <section className="trading-hero-card">
          <h2 className="trading-section-title">How the shortlist is ranked</h2>
          <p>
            This version rewards names that are both moving and actively traded,
            gives a small boost to names holding a meaningful gap, and lightly
            penalizes sub-$5 symbols where slippage can get messy.
          </p>
          <p className="meta">Last updated {formatTimestamp(screener.lastUpdated)}</p>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 className="trading-section-title">Top Picks</h2>
          {screener.picks.length === 0 ? (
            <div className="card">
              <p>No screener candidates were available right now.</p>
            </div>
          ) : (
            <ul className="card-list">
              {screener.picks.slice(0, 12).map((pick) => (
                <li key={pick.symbol} className="card">
                  <div className="signal-chart-header">
                    <div>
                      <h3 className="card-title">{pick.symbol}</h3>
                      <p className="meta">
                        Score {pick.score} · Price {formatMoney(pick.price)} · Change{" "}
                        {formatPercent(pick.percentChange)}
                      </p>
                    </div>
                    <div className="badge-row">
                      {pick.tags.map((tag) => (
                        <span key={tag} className="badge" style={{ marginRight: "0.5rem" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="trading-metric-row">
                    <div className="trading-metric-card">
                      <span className="trading-metric-label">Volume</span>
                      <strong>{formatCompactNumber(pick.volume)}</strong>
                    </div>
                    <div className="trading-metric-card">
                      <span className="trading-metric-label">Trade count</span>
                      <strong>{formatCompactNumber(pick.tradeCount)}</strong>
                    </div>
                    <div className="trading-metric-card">
                      <span className="trading-metric-label">Prev close</span>
                      <strong>{formatMoney(pick.previousClose)}</strong>
                    </div>
                  </div>

                  <div className="trading-insight-card">
                    <strong>Why it ranked:</strong>
                    <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.2rem" }}>
                      {pick.reasons.slice(0, 3).map((reason) => (
                        <li key={reason} style={{ marginBottom: "0.35rem" }}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    <Link
                      href={`/trading/algo?symbol=${encodeURIComponent(pick.symbol)}`}
                      className="button-link"
                    >
                      Review In Algo Workspace
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pipeline-grid">
          <div className="card pipeline-card">
            <h2 className="trading-section-title">Top Gainers</h2>
            {screener.gainers.slice(0, 5).map((stock) => (
              <p key={stock.symbol} className="meta">
                {stock.symbol} · {formatMoney(stock.price)} · {formatPercent(stock.percentChange)}
              </p>
            ))}
          </div>

          <div className="card pipeline-card">
            <h2 className="trading-section-title">Most Active</h2>
            {screener.mostActive.slice(0, 5).map((stock) => (
              <p key={stock.symbol} className="meta">
                {stock.symbol} · Vol {formatCompactNumber(stock.volume)} · Trades{" "}
                {formatCompactNumber(stock.tradeCount)}
              </p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
